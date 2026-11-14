/* jsdom test for v51 "Before you leave" ready check.
   Boots the real index.html + app.js (stubbed audio/geo/network) and exercises:
   the checklist offer + 3-step flow (breath auto-advance + skip, tool pick
   with the journal default, cue word + save, backup-plan glance); the trip
   line on start-trip and its clearing on end-trip; the 15-minute pick
   staleness rule; the skip path; back buttons; the reduced-motion path;
   corrupt-journal safety; panic isolation; version markers; no voice,
   no paywall.
   Usage: node tools/tests/test-ready.js  (run from the project root) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function waitFor(fn, label) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (fn()) { return true; }
    await sleep(25);
  }
  ok(false, 'timed out waiting for: ' + label);
  return false;
}

function boot(opts) {
  opts = opts || {};
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script src="(drift|trimap|crisis|app|stopheads|guide|sound|calm42|ready)\.js"><\/script>/g, '<!-- inlined by test -->');
  const dom = new JSDOM(html, {
    url: 'https://i-hate-trains-aaryan0909s-projects.vercel.app/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.AudioContext = function () {
        return {
          createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0 }, type: '' }; },
          createGain() { return { connect() {}, gain: { value: 0 } }; },
          createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; },
          currentTime: 0, destination: {},
        };
      };
      Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
      window.navigator.geolocation = {
        watchPosition() { return 1; }, clearWatch() {},
        getCurrentPosition(s) { s({ coords: { latitude: 43.65, longitude: -79.38 } }); }
      };
      window.matchMedia = window.matchMedia || ((q) => ({
        matches: !!opts.reducedMotion && String(q).indexOf('prefers-reduced-motion') !== -1,
        addListener() {}, removeListener() {}
      }));
      window.confirm = () => true;
      const ttcRaw = fs.readFileSync(path.join(ROOT, 'ttc.json'), 'utf8');
      window.fetch = function (url) {
        if (String(url).indexOf('ttc.json') !== -1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(ttcRaw)) });
        }
        return Promise.reject(new Error('offline-test: no network for ' + url));
      };
    }
  });
  const w = dom.window;
  w.localStorage.setItem('iht_onboarded', '1');
  if (opts.journal !== undefined) { w.localStorage.setItem('iht_journal', opts.journal); }
  if (opts.plan !== undefined) { w.localStorage.setItem('iht_plan', opts.plan); }
  if (opts.cue !== undefined) { w.localStorage.setItem('iht_ready_cue', opts.cue); }
  ['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js', 'sound.js', 'ready.js'].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  return { w: w, d: w.document };
}
function activeId(d) { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
function click(el) { el.click(); }
function stepVisible(d, n) { const el = d.getElementById('ready-step' + n); return !!el && !el.hidden; }
function pressedChip(d, hostId) {
  const host = d.getElementById(hostId);
  if (!host) { return null; }
  const chips = Array.prototype.slice.call(host.querySelectorAll('.chip'));
  const on = chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; });
  return on.length ? on[0] : null;
}
function goChecklist(env) {
  const d = env.d;
  click(d.getElementById('btn-start-ride'));
  ok(activeId(d) === 'screen-checkin', 'start ride -> checkin');
  click(d.querySelector('#screen-checkin .feelbtn[data-feel="steady"]'));
  click(d.getElementById('btn-checkin-continue'));
  ok(activeId(d) === 'screen-checklist', 'checkin continue -> checklist');
}
function openReady(env) {
  const d = env.d, w = env.w;
  w.__ihtReady.timing.inMs = 10;
  w.__ihtReady.timing.outMs = 10;
  click(d.getElementById('btn-ready-start'));
  ok(activeId(d) === 'screen-ready', 'offer -> ready screen');
  ok(d.getElementById('ready-count').textContent === 'Step 1 of 3', 'count reads Step 1 of 3');
  ok(stepVisible(d, 1) && !stepVisible(d, 2) && !stepVisible(d, 3), 'only step 1 visible');
  ok(d.getElementById('pet-ready').innerHTML.length > 0, 'pet mounted on the ready screen');
  ok(d.getElementById('ready-breath-cue').textContent === 'Breathe in…', 'breath cue starts "Breathe in…"');
}

(async function main() {
  /* ---------- A. full flow, empty journal ---------- */
  let env = boot();
  let d = env.d, w = env.w;
  goChecklist(env);
  ok(!!d.getElementById('btn-ready-start'), 'checklist offers the ready check');
  ok(d.getElementById('btn-ready-start').getAttribute('data-go') === 'screen-ready', 'offer navigates to screen-ready');
  openReady(env);
  await waitFor(function () { return stepVisible(d, 2); }, 'step 2');
  ok(stepVisible(d, 2), 'breath auto-advances to step 2');
  ok(d.getElementById('ready-count').textContent === 'Step 2 of 3', 'count reads Step 2 of 3');
  ok(d.querySelectorAll('#ready-tools .chip').length === 13, '13 tool chips');
  let def = pressedChip(d, 'ready-tools');
  ok(def && def.getAttribute('data-tool') === 'breathe', 'empty journal defaults to breathe');
  ok(d.getElementById('ready-default-note').textContent.indexOf('good place to start') !== -1, 'no-history note is honest, no false claim');
  click(d.querySelector('#ready-tools .chip[data-tool="five-senses"]'));
  ok(w.__ihtReady.state().tool === 'five-senses', 'tapping a tool changes the pick');
  ok(pressedChip(d, 'ready-tools').getAttribute('data-tool') === 'five-senses', 'only the tapped chip is pressed');
  click(d.getElementById('btn-ready-next2'));
  ok(stepVisible(d, 3), 'next -> step 3');
  ok(d.querySelectorAll('#ready-cues .chip').length === 4, '4 cue presets');
  ok(d.getElementById('ready-plan-line').textContent.indexOf('No backup plan saved yet') !== -1, 'no-plan glance is honest');
  click(d.querySelectorAll('#ready-cues .chip')[0]);
  ok(d.getElementById('in-ready-cue').value === 'steady', 'preset fills the cue input');
  d.getElementById('in-ready-cue').value = 'calm now';
  d.getElementById('in-ready-cue').dispatchEvent(new w.Event('input', { bubbles: true }));
  ok(w.__ihtReady.state().cue === 'calm now', 'custom cue word is kept');
  click(d.getElementById('btn-ready-finish'));
  ok(activeId(d) === 'screen-setup', 'finish -> ride setup');
  ok(w.localStorage.getItem('iht_ready_cue') === 'calm now', 'cue word saved on-device');
  ok(w.__ihtReady.pick() && w.__ihtReady.pick().tool === 'five-senses', 'pick set for this ride');
  click(d.getElementById('btn-start-trip'));
  ok(activeId(d) === 'screen-trip', 'start trip -> trip screen');
  const line = d.getElementById('trip-ready-line');
  ok(!line.hidden && line.textContent.indexOf('5–4–3–2–1 senses') !== -1, 'trip line names the picked tool');
  ok(line.textContent.indexOf('calm now') !== -1, 'trip line carries the cue word');
  click(d.getElementById('btn-end-trip'));
  ok(activeId(d) === 'screen-arrived', 'end trip -> arrived');
  ok(w.__ihtReady.pick() === null, 'ending the trip clears the pick');
  click(d.getElementById('btn-im-home'));
  click(d.getElementById('btn-reflect-done'));
  ok(activeId(d) === 'screen-home', 'reflect done -> home');
  goChecklist(env);
  click(d.querySelector('[data-go="screen-setup"]'));
  ok(activeId(d) === 'screen-setup', 'skip the check via All set -> setup');
  click(d.getElementById('btn-start-trip'));
  ok(d.getElementById('trip-ready-line').hidden, 'a later trip without the check shows no line');

  /* ---------- B. skip path from the ready screen ---------- */
  env = boot(); d = env.d; w = env.w;
  goChecklist(env);
  openReady(env);
  click(d.getElementById('btn-ready-skip'));
  ok(activeId(d) === 'screen-setup', 'skip link -> setup');
  ok(w.__ihtReady.pick() === null, 'skipping sets no pick');
  click(d.getElementById('btn-start-trip'));
  ok(d.getElementById('trip-ready-line').hidden, 'skipped check -> no trip line');

  /* ---------- C. back buttons + step-1 Next ---------- */
  env = boot(); d = env.d; w = env.w;
  goChecklist(env);
  openReady(env);
  click(d.getElementById('btn-ready-next1'));
  ok(stepVisible(d, 2), 'step-1 Next jumps to step 2 (no waiting)');
  click(d.getElementById('btn-ready-back2'));
  ok(stepVisible(d, 1), 'step-2 back -> step 1');
  click(d.getElementById('btn-ready-next1'));
  click(d.getElementById('btn-ready-next2'));
  click(d.getElementById('btn-ready-back3'));
  ok(stepVisible(d, 2), 'step-3 back -> step 2');

  /* ---------- D. journal default: top tool, ties, breath titles, honesty ---------- */
  const j = (entries) => JSON.stringify(entries.map(function (tools) { return { t: '2026-11-01T00:00:00.000Z', tools: tools }; }));
  env = boot({ journal: j([['5–4–3–2–1 senses'], ['5–4–3–2–1 senses'], ['Kind, factual words']]) });
  d = env.d; w = env.w;
  goChecklist(env); openReady(env); await waitFor(function () { return stepVisible(d, 2); }, 'step 2');
  def = pressedChip(d, 'ready-tools');
  ok(def && def.getAttribute('data-tool') === 'five-senses', 'journal top tool (2 rides) is the default');
  ok(d.getElementById('ready-default-note').textContent.indexOf('helped you most') !== -1, 'default note names the journal basis');
  env = boot({ journal: j([['5–4–3–2–1 senses'], ['Kind, factual words'], ['Breathe with me']]) });
  d = env.d; w = env.w;
  goChecklist(env); openReady(env); await waitFor(function () { return stepVisible(d, 2); }, 'step 2');
  def = pressedChip(d, 'ready-tools');
  ok(def && def.getAttribute('data-tool') === 'breathe', 'tie breaks toward the most recent ride');
  env = boot({ journal: j([['Even square breathing'], ['Even square breathing'], ['Kind, factual words']]) });
  d = env.d; w = env.w;
  goChecklist(env); openReady(env); await waitFor(function () { return stepVisible(d, 2); }, 'step 2');
  def = pressedChip(d, 'ready-tools');
  ok(def && def.getAttribute('data-tool') === 'breathe', 'breath-pattern journal titles map to the breathe pick');
  env = boot({ journal: j([['5–4–3–2–1 senses'], ['Kind, factual words']]) });
  d = env.d; w = env.w;
  goChecklist(env); openReady(env); await waitFor(function () { return stepVisible(d, 2); }, 'step 2');
  def = pressedChip(d, 'ready-tools');
  ok(def && def.getAttribute('data-tool') === 'breathe', 'fewer than 3 rides -> no journal claim, breathe default');
  env = boot({ journal: 'not json{{{ ' });
  d = env.d; w = env.w;
  goChecklist(env); openReady(env); await waitFor(function () { return stepVisible(d, 2); }, 'step 2');
  def = pressedChip(d, 'ready-tools');
  ok(def && def.getAttribute('data-tool') === 'breathe', 'corrupt journal -> breathe default, no throw');
  env = boot({ journal: j([['Nonexistent tool'], ['Nonexistent tool'], ['Also unknown']]) });
  d = env.d; w = env.w;
  goChecklist(env); openReady(env); await waitFor(function () { return stepVisible(d, 2); }, 'step 2');
  def = pressedChip(d, 'ready-tools');
  ok(def && def.getAttribute('data-tool') === 'breathe', 'unknown journal titles never counted');

  /* ---------- E. plan glance with a saved plan + saved cue prefill ---------- */
  env = boot({ plan: JSON.stringify({ exit: 'Bloor-Yonge', reachName: 'Div', reach: '', reachPhone: '', pocket: ['Water'], c1: '', c2: '', c3: '' }), cue: 'steady' });
  d = env.d; w = env.w;
  goChecklist(env); openReady(env); await waitFor(function () { return stepVisible(d, 2); }, 'step 2');
  click(d.getElementById('btn-ready-next2'));
  ok(d.getElementById('ready-plan-line').textContent === 'Your plan: get off at Bloor-Yonge, call Div.', 'plan glance reads the saved plan');
  ok(d.getElementById('in-ready-cue').value === 'steady', 'saved cue word is prefilled');

  /* ---------- F. 15-minute staleness ---------- */
  env = boot(); d = env.d; w = env.w;
  goChecklist(env); openReady(env); await waitFor(function () { return stepVisible(d, 2); }, 'step 2');
  click(d.getElementById('btn-ready-next2'));
  click(d.getElementById('btn-ready-finish'));
  const at = w.__ihtReady.pick().at;
  const realNow = w.Date.now;
  w.Date.now = function () { return at + 16 * 60 * 1000; };
  click(d.getElementById('btn-start-trip'));
  ok(d.getElementById('trip-ready-line').hidden, 'a pick older than 15 minutes never rides along');
  w.Date.now = realNow;

  /* ---------- G. reduced motion: no auto-advance, hand advance works ---------- */
  env = boot({ reducedMotion: true }); d = env.d; w = env.w;
  goChecklist(env);
  click(d.getElementById('btn-ready-start'));
  ok(activeId(d) === 'screen-ready', 'reduced motion: ready screen still opens');
  ok(d.getElementById('ready-breath-cue').textContent.indexOf('and out') !== -1, 'reduced motion: static breath cue, no swell');
  await sleep(60);
  ok(stepVisible(d, 1), 'reduced motion: no auto-advance');
  click(d.getElementById('btn-ready-next1'));
  ok(stepVisible(d, 2), 'reduced motion: Next still advances by hand');

  /* ---------- H. markers + isolation ---------- */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const readySrc = fs.readFileSync(path.join(ROOT, 'ready.js'), 'utf8');
  ok(html.indexOf('version 51') !== -1, 'About reads "version 51"');
  ok(sw.indexOf('iht-v51') !== -1, 'sw.js cache is iht-v51');
  ok(sw.indexOf("'ready.js'") !== -1, 'sw.js precaches ready.js');
  ok(html.indexOf('<script src="ready.js"></script>') !== -1, 'index.html loads ready.js');
  ok(readySrc.indexOf('speechSynthesis') === -1, 'no voice code added (speechSynthesis absent)');
  const readyCode = readySrc.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/Stripe|premium|paywall/i.test(readyCode) === false, 'no paywall/premium/Stripe in the new module (comments stripped)');
  env = boot(); d = env.d;
  ok(d.getElementById('screen-panic').innerHTML.indexOf('ready-') === -1, 'panic screen carries no ready markup');
  ok(d.getElementById('screen-panic').innerHTML.indexOf('trip-ready-line') === -1, 'panic screen carries no trip line');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
