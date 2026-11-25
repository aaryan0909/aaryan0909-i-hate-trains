/* Regression tests for the 2026-11-25 dead-button audit findings (v59).
   - A plan saved before the pocket list existed has no `pocket` array: adding
     a pocket item threw (app.js plan.pocket.push on undefined) and nothing
     was added. Fixed by normalizing pocket on load.
   - A letters-only local crisis number showed a dead tel: link (href tel:
     with nothing after it). The row now hides unless the number has
     dialable digits.
   - The toolkit's featured row never rendered: #toolkit-featured did not
     exist in index.html, so the four touch tools (swipe breathing, trace,
     hold, butterfly taps) had no card anywhere. The host div is restored.
   - screen-nonbreath had no entry point anywhere. The panic screen now
     carries a quiet "Breathing and counting don't work for me" link.
   - Copy panic link: the hint only updates inside the clipboard promise's
     .then, so the audit harness needs a synchronous thenable (see
     test-audit.js); this test pins the app side (hint changes, link text).
   Usage: node tools/tests/test-audit-fixes.js (run from repo root or tools/tests). */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}
const tick = () => new Promise(r => setImmediate(r));
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MODULES = ['drift.js', 'trimap.js', 'crisis.js', 'metros.js', 'stations.js',
  'sound.js', 'app.js', 'stopheads.js', 'guide.js', 'calm42.js', 'ready.js', 'platform.js', 'auth.js'];
const SRC = {};
MODULES.forEach(f => { SRC[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
const TTC = fs.readFileSync(path.join(ROOT, 'ttc.json'), 'utf8');
// Legacy plan: saved before the pocket list existed (no `pocket` key).
const SEED = {
  iht_onboarded: '1',
  iht_plan: JSON.stringify({ note: 'Text Div. Sit near the door.', backup: 'Maya', local: '', steps: ['Text Div', 'Sit near the door'] }),
  iht_crisis_person: JSON.stringify({ name: 'Maya', num: '4165550123' }),
};

async function boot(seed) {
  const vc = new VirtualConsole();
  const errs = [];
  vc.on('jsdomError', e => { const m = String(e && e.message || e); if (!/Not implemented: navigation/.test(m)) errs.push(m); });
  let now = 0;
  const queue = [];
  let timerId = 0;
  const dom = new JSDOM(HTML, {
    url: 'https://x/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      window.IHT_ACCOUNT_CONFIG = { supabaseUrl: 'https://YOUR-PROJECT.supabase.co', supabaseAnonKey: 'YOUR-SUPABASE-ANON-KEY', localPreview: false };
      window.AudioContext = function () { return { createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0 }, type: '' }; }, createGain() { return { connect() {}, gain: { value: 0 } }; }, createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }, currentTime: 0, destination: {}, resume() { return Promise.resolve(); }, state: 'running' }; };
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      window.confirm = () => true; window.alert = () => {}; window.scrollTo = () => {};
      window.navigator.geolocation = { watchPosition() { return 1; }, clearWatch() {}, getCurrentPosition(s) { s({ coords: { latitude: 43.65, longitude: -79.38 } }); } };
      window.navigator.vibrate = () => true; window.navigator.share = () => Promise.resolve();
      window.navigator.clipboard = { writeText: (t) => { window.__clip = t; return { then(cb) { try { cb && cb(); } catch (e) {} return this; }, catch() { return this; } }; } };
      window.print = () => {}; window.open = () => null;
      window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
      window.fetch = (u) => String(u).indexOf('ttc.json') !== -1
        ? { then(cb) { cb({ ok: true, json: () => ({ then(c2) { c2(JSON.parse(TTC)); return this; } }) }); return this; } }
        : { then(cb) { cb({ ok: false }); return this; } };
      window.setTimeout = (fn, ms) => { const id = ++timerId; queue.push({ id, fn, ms: ms || 0, at: now + (ms || 0) }); return id; };
      window.clearTimeout = (id) => { const i = queue.findIndex(q => q.id === id); if (i >= 0) queue.splice(i, 1); };
      window.setInterval = (fn, ms) => { const id = ++timerId; queue.push({ id, fn, ms: ms || 0, at: now + (ms || 0), iv: true }); return id; };
      window.clearInterval = window.clearTimeout;
    },
  });
  const w = dom.window;
  const d = w.document;
  Object.keys(seed || SEED).forEach(k => w.localStorage.setItem(k, (seed || SEED)[k]));
  Object.keys(SRC).forEach(f => w.eval(SRC[f]));
  await tick(); // jsdom's real DOMContentLoaded
  function drain(maxMs) {
    const end = now + maxMs;
    for (let n = 0; n < 500; n++) {
      let bi = -1, bt = Infinity;
      queue.forEach((q, i) => { if (q.at <= end && q.at < bt) { bt = q.at; bi = i; } });
      if (bi < 0) break;
      const q = queue.splice(bi, 1)[0];
      now = q.at;
      try { q.fn(); } catch (e) {}
      if (q.iv) queue.push({ id: q.id, fn: q.fn, ms: q.ms, at: now + q.ms, iv: true });
    }
  }
  drain(2600);
  return { w, d, errs, drain, close() { try { w.close(); } catch (e) {} } };
}
function active(d) { const a = d.querySelector('.screen.active'); return a ? a.id : '(none)'; }
function go(d, screen) { const b = d.querySelector('[data-go="' + screen + '"]'); if (b) b.click(); }

(async () => {
  console.log('audit fixes: pocket crash, crisis-local, featured row, non-breath entry, panic link:');

  // 1. Pocket add on a legacy plan (no pocket array).
  let b = await boot();
  go(b.d, 'screen-learn'); go(b.d, 'screen-plan');
  ok(active(b.d) === 'screen-plan', 'plan screen reachable');
  const inp = b.d.getElementById('plan-pocket-in');
  inp.value = 'Water';
  inp.dispatchEvent(new b.w.Event('input', { bubbles: true }));
  const errsBefore = b.errs.length;
  b.d.getElementById('plan-pocket-add').click();
  b.drain(500);
  const saved = JSON.parse(b.w.localStorage.getItem('iht_plan') || '{}');
  ok(b.errs.length === errsBefore, 'adding a pocket item throws nothing (was TypeError on plan.pocket.push)');
  ok(Array.isArray(saved.pocket) && saved.pocket.indexOf('Water') !== -1, 'pocket item saved to the plan');
  ok(b.d.getElementById('plan-pocket').textContent.indexOf('Water') !== -1, 'pocket chip renders');
  // Chip remove (the splice path) works on the normalized array.
  const chip = Array.from(b.d.querySelectorAll('#plan-pocket .chip')).find(c => c.textContent.indexOf('Water') !== -1);
  chip.click();
  b.drain(500);
  const saved2 = JSON.parse(b.w.localStorage.getItem('iht_plan') || '{}');
  ok(Array.isArray(saved2.pocket) && saved2.pocket.indexOf('Water') === -1, 'pocket chip remove works');
  b.close(); await tick();

  // 2. Crisis local number: letters-only hides the row; a real number shows it.
  b = await boot();
  go(b.d, 'screen-crisis');
  const local = b.d.getElementById('in-crisis-local');
  local.value = 'test';
  local.dispatchEvent(new b.w.Event('change', { bubbles: true }));
  b.drain(500);
  ok(b.d.getElementById('crisis-local').hidden === true, 'letters-only local number hides the row (no dead tel: link)');
  local.value = '416 555 0123';
  local.dispatchEvent(new b.w.Event('change', { bubbles: true }));
  b.drain(500);
  const row = b.d.getElementById('crisis-local');
  ok(row.hidden === false && row.getAttribute('href') === 'tel:4165550123', 'valid local number shows with a dialable tel: link');
  b.close(); await tick();

  // 3. Featured toolkit row: the four touch tools are cards, and they open.
  b = await boot();
  go(b.d, 'screen-toolkit');
  const feat = Array.from(b.d.querySelectorAll('#toolkit-featured .toolcard')).map(c => c.textContent);
  ok(feat.length === 6, 'featured row renders 6 cards (got ' + feat.length + ')');
  ['Swipe breathing', 'Trace calm', 'Hold to steady', 'Butterfly taps'].forEach(t => {
    ok(feat.some(x => x.indexOf(t) !== -1), 'featured row includes "' + t + '"');
  });
  const sw = Array.from(b.d.querySelectorAll('#toolkit-featured .toolcard')).find(c => c.textContent.indexOf('Swipe breathing') !== -1);
  sw.click();
  b.drain(500);
  ok(active(b.d) === 'screen-swipebreathe', 'Swipe breathing card opens its tool screen');
  b.close(); await tick();

  // 4. Non-breath entry from the panic screen.
  b = await boot();
  go(b.d, 'screen-panic');
  const nb = b.d.getElementById('btn-panic-nonbreath');
  ok(!!nb && !nb.hidden, 'panic screen has the non-breath link');
  nb.click();
  b.drain(500);
  ok(active(b.d) === 'screen-nonbreath', 'non-breath link opens screen-nonbreath');
  ok(b.d.querySelectorAll('#nonbreath-list .toolcard').length >= 10, 'non-breath list renders its tools');
  b.close(); await tick();

  // 5. Copy panic link updates the hint (clipboard .then runs inline).
  b = await boot();
  go(b.d, 'screen-learn'); go(b.d, 'screen-privacy');
  b.d.getElementById('btn-copy-panic-link').click();
  b.drain(500);
  ok(b.d.getElementById('panic-link-hint').textContent.indexOf('copied') !== -1, 'copy panic link confirms in the hint');
  ok(typeof b.w.__clip === 'string' && b.w.__clip.indexOf('#panic') !== -1, 'clipboard received the #panic link');
  b.close(); await tick();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('  FAIL harness error: ' + (e && e.stack || e)); process.exit(1); });
