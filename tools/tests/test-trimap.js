/* TriMap path test (v59): the map-based ride setup is the only way to reach
   screen-trimap, so the dead-button audit (test-audit.js) cannot cover it —
   its scripted flow uses the plain setup selects, which never set
   TriMap.current. This test drives the real chooser UI instead:
   setup -> "Ride Line 1 — your usual." -> "Use this ride." (map checkbox
   on by default) -> start trip -> "Show the map" -> screen-trimap, and
   back to the ride. If this fails, the map screen is unreachable in the
   app, not just untested.
   Usage: node tools/tests/test-trimap.js (run from repo root or tools/tests). */
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
const SEED = {
  iht_onboarded: '1',
  iht_profile: JSON.stringify({ city: 'Toronto', line: 'Line 1', name: 'Aaryan' }),
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
      window.navigator.clipboard = { writeText: () => ({ then(cb) { cb(); return this; } }) };
      window.print = () => {}; window.open = () => null;
      window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
      // Synchronous thenables (same pattern as test-audit.js): trimap.js
      // chains fetch().then(r => r.json()).then(data => ...), so each
      // .then must receive the previous callback's return value.
      const syncVal = (v) => ({
        then(cb) { let out; try { out = cb ? cb(v) : v; } catch (e) { return syncRej(e); } return (out && typeof out.then === 'function') ? out : syncVal(out); },
        catch() { return this; },
      });
      const syncRej = (e) => ({
        then(cb, eb) { if (!eb) return syncRej(e); let out; try { out = eb(e); } catch (e2) { return syncRej(e2); } return (out && typeof out.then === 'function') ? out : syncVal(out); },
        catch(cb) { let out; try { out = cb(e); } catch (e2) { return syncRej(e2); } return (out && typeof out.then === 'function') ? out : syncVal(out); },
      });
      window.fetch = (u) => String(u).indexOf('ttc.json') !== -1
        ? syncVal({ ok: true, json: () => syncVal(JSON.parse(TTC)) })
        : syncVal({ ok: false, json: () => syncRej(new Error('no data')) });
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
function btn(d, text) {
  return Array.from(d.querySelectorAll('button')).find(b => b.textContent.trim().indexOf(text) !== -1);
}

(async () => {
  console.log('trimap: chooser -> trip -> map screen:');
  const b = await boot();
  b.d.getElementById('btn-start-ride').click(); // -> checkin
  b.d.querySelector('[data-feel="steady"]').click();
  b.d.getElementById('btn-checkin-continue').click(); // -> checklist
  b.d.querySelector('#screen-checklist [data-go="screen-setup"]').click(); // -> setup
  ok(active(b.d) === 'screen-setup', 'setup screen reached');
  b.drain(500);
  const usual = btn(b.d, 'Ride Line 1');
  ok(!!usual, 'chooser offers the usual Line 1 ride');
  usual.click();
  b.drain(500);
  const useBtn = btn(b.d, 'Use this ride');
  ok(!!useBtn, 'chooser stops step shows "Use this ride."');
  ok(!useBtn.disabled, 'origin and destination differ, so the ride is usable');
  useBtn.click();
  b.drain(500);
  ok(b.w.TriMap && b.w.TriMap.current && b.w.TriMap.current.useMap === true, 'chooser pick sets TriMap.current with useMap on');
  b.d.getElementById('btn-start-trip').click(); // -> trip
  ok(active(b.d) === 'screen-trip', 'trip screen reached');
  const showMap = b.d.getElementById('btn-show-map');
  ok(showMap && showMap.hidden === false, '"Show the map" is visible on the trip screen');
  showMap.click();
  b.drain(500);
  ok(active(b.d) === 'screen-trimap', 'map button opens screen-trimap');
  ok(b.d.getElementById('trimap-mount').textContent.indexOf('Line 1') !== -1, 'map renders the Line 1 header');
  ok(!!b.d.querySelector('#trimap-mount svg'), 'map renders the line SVG');
  // Scope to the map mount: "back to ride prep" on the ready screen also
  // contains the substring, and an unscoped search finds that one first.
  const back = b.d.querySelector('#trimap-mount .tm-back');
  ok(!!back && back.textContent.indexOf('back to ride') !== -1, 'map has a back-to-ride button');
  back.click();
  b.drain(500);
  ok(active(b.d) === 'screen-trip', 'back from the map returns to the trip');
  ok(b.errs.length === 0, 'no jsdom errors on the map path' + (b.errs.length ? (': ' + b.errs[0]) : ''));
  b.close(); await tick();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('  FAIL harness error: ' + (e && e.stack || e)); process.exit(1); });
