/* jsdom test for v50 "Reading doesn't get yanked": the panic freeze waits
   while the rider is visibly reading.
   - Stillness on the panic screen still auto-starts the guided rescue, now
     after 8s (was 5s).
   - Visible reading activity re-arms the timer: pointermove, scroll, keydown,
     and the pre-existing tap (pointerdown) each push the rescue out.
   - Navigating away from the panic screen clears the timer (no rescue fires
     on the screen you left for).
   No scores, no streaks, no voice (speechSynthesis removed in v35).
   Usage: node tools/tests/test-freeze.js (run from repo root or tools/tests). */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

console.log('static: 8s window, activity re-arms, version markers:');
ok(/var PANIC_FREEZE_MS = 8000/.test(appJs), 'freeze window is 8s (PANIC_FREEZE_MS = 8000)');
ok(/}, PANIC_FREEZE_MS\)/.test(appJs), 'armPanicFreeze uses PANIC_FREEZE_MS');
ok(!/}, 5000\)/.test(appJs), 'no 5s freeze timer left in app.js');
ok(appJs.includes("'pointerdown', 'pointermove', 'wheel', 'touchmove', 'keydown'"), 'tap + pointer drift + wheel + touch + keys all re-arm');
ok(appJs.includes("document.addEventListener('scroll'"), 'scroll re-arms the freeze');
ok(/if \(currentScreen\(\) === 'screen-panic'\) \{ armPanicFreeze\(\); \}/.test(appJs), 'activity re-arm is gated to the panic screen');
ok(appJs.includes('window.__ihtGuide.start()'), 'freeze still starts the guided rescue');
ok(html.includes('version 50'), 'About reads version 50');
ok(/var CACHE = 'iht-v50'/.test(sw), 'sw.js cache is iht-v50');
ok(!/speechSynthesis/.test(appJs), 'no speechSynthesis anywhere in app.js (voice removed v35)');

/* Live boot check: #panic lands straight on the panic screen, so the freeze
   timer is already running at build time. */
function build(url, onboarded) {
  let h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  h = h.replace(/<script src="(drift|trimap|crisis|app|stopheads|guide)\.js"><\/script>/g, '<!-- inlined by test -->');
  const dom = new JSDOM(h, {
    url: url,
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
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      window.confirm = () => true;
      window.navigator.geolocation = {
        watchPosition() { return 1; }, clearWatch() {},
        getCurrentPosition(s) { s({ coords: { latitude: 43.65, longitude: -79.38 } }); }
      };
      const ttcRaw = fs.readFileSync(path.join(ROOT, 'ttc.json'), 'utf8');
      window.fetch = function (u) {
        if (String(u).indexOf('ttc.json') !== -1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(ttcRaw)) });
        }
        return Promise.reject(new Error('offline-test: no network for ' + u));
      };
    }
  });
  const w = dom.window;
  if (onboarded) { w.localStorage.setItem('iht_onboarded', '1'); }
  ['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js'].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  return { w: w, d: w.document };
}
function active(d) { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
function fire(w, d, type) { d.dispatchEvent(new w.Event(type, { bubbles: true, cancelable: true })); }

(async function live() {
  const PROD = 'https://i-hate-trains-aaryan0909s-projects.vercel.app/';

  console.log('live: stillness still fires the rescue, now at 8s:');
  let t = build(PROD + '#panic', true);
  ok(active(t.d) === 'screen-panic', '#panic boot lands on screen-panic');
  await sleep(7000); // past the old 5s window: the old freeze would have fired
  ok(active(t.d) === 'screen-panic', 'still on the panic screen at 7s (old 5s window is gone)');
  await sleep(2000); // past the new 8s window
  ok(active(t.d) === 'screen-guide', 'stillness fires the guided rescue after 8s');

  console.log('live: pointer drift re-arms the timer:');
  t = build(PROD + '#panic', true);
  ok(active(t.d) === 'screen-panic', 'second boot lands on screen-panic');
  await sleep(6000);
  fire(t.w, t.d, 'pointermove'); // reading, not frozen: drift at 6s
  await sleep(6000); // 12s after boot, 6s after the drift
  ok(active(t.d) === 'screen-panic', 'still on the panic screen 6s after a pointer drift');
  await sleep(3000); // past 8s since the drift
  ok(active(t.d) === 'screen-guide', 'rescue fires 8s after the last drift, not after boot');

  console.log('live: scroll re-arms the timer:');
  t = build(PROD + '#panic', true);
  await sleep(6000);
  fire(t.w, t.d, 'scroll'); // a reader scrolling the options at 6s
  await sleep(6000);
  ok(active(t.d) === 'screen-panic', 'still on the panic screen 6s after a scroll');
  await sleep(3000);
  ok(active(t.d) === 'screen-guide', 'rescue fires 8s after the last scroll');

  console.log('live: keydown, then a tap, each re-arm in turn:');
  t = build(PROD + '#panic', true);
  await sleep(6000);
  fire(t.w, t.d, 'keydown'); // keyboard reader at 6s
  await sleep(6000); // 12s after boot; the rescue would have fired at 8s without the key
  ok(active(t.d) === 'screen-panic', 'still on the panic screen 6s after a key press');
  fire(t.w, t.d, 'pointerdown'); // a tap at ~12s
  await sleep(6000); // 18s after boot; 6s after the tap
  ok(active(t.d) === 'screen-panic', 'still on the panic screen 6s after a tap');
  await sleep(3000);
  ok(active(t.d) === 'screen-guide', 'rescue fires 8s after the last tap');

  console.log('live: navigating away clears the freeze:');
  t = build(PROD + '#panic', true);
  ok(active(t.d) === 'screen-panic', 'fifth boot lands on screen-panic');
  t.d.querySelector('#screen-panic .backlink[data-go="screen-home"]').click();
  ok(active(t.d) === 'screen-home', 'back link leaves the panic screen');
  await sleep(9000); // past the whole 8s window
  ok(active(t.d) === 'screen-home', 'no rescue fires after leaving the panic screen');
  ok(active(t.d) !== 'screen-guide', 'guide never started off-screen');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('  FAIL harness error: ' + (e && e.stack || e)); process.exit(1); });
