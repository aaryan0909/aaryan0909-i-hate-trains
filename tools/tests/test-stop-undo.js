/* jsdom test for v48 "One tap back": the stop counter has an undo, and
   double-taps cannot fake an arrival.
   - Taps within 700ms of the previous tap are ignored as a bounce.
   - After each tap a quiet "Not yet — one back" link shows for 10s and
     restores one stop, capped at the trip total.
   - The arrived screen gains "Not yet — I'm still riding", which restores
     the pre-arrival count (1 after a mistaken final tap, the live count
     after an early End trip) and returns to the trip screen.
   No scores, no streaks, no voice (speechSynthesis removed in v35).
   Usage: node tools/tests/test-stop-undo.js (run from repo root or tools/tests). */
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
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

console.log('markup: undo on the trip screen, still-riding on the arrived screen:');
const tripSection = html.slice(html.indexOf('id="screen-trip"'), html.indexOf('id="screen-trimap"'));
ok(tripSection.includes('id="btn-stop-undo"'), 'trip screen has btn-stop-undo');
ok(tripSection.includes('Not yet — one back'), 'undo copy present');
ok(/id="btn-stop-undo"[^>]*hidden/.test(tripSection), 'undo button hidden by default in markup');
ok(tripSection.indexOf('id="btn-stop-undo"') > tripSection.indexOf('id="btn-stop-tap"'), 'undo sits below the big tap button');
ok(tripSection.indexOf('id="btn-stop-undo"') < tripSection.indexOf('id="trip-fine"'), 'undo sits above the fineprint');
const arrivedSection = html.slice(html.indexOf('id="screen-arrived"'), html.indexOf('id="screen-reflect"'));
ok(arrivedSection.includes('id="btn-arrived-still"'), 'arrived screen has btn-arrived-still');
ok(arrivedSection.includes('Not yet — I\'m still riding'), 'still-riding copy present');
ok(arrivedSection.indexOf('id="btn-arrived-still"') > arrivedSection.indexOf('id="btn-im-home"'), 'still-riding sits below the primary I\'m off button');
ok(arrivedSection.indexOf('id="btn-arrived-still"') < arrivedSection.indexOf('id="home-note"'), 'still-riding sits above the fineprint');

console.log('app.js wiring + safety:');
ok(appJs.includes('lastAdvanceAt'), 'debounce clock present');
ok(/now - lastAdvanceAt < 700/.test(appJs), 'taps inside 700ms are ignored as a bounce');
ok(appJs.includes('function showStopUndo'), 'showStopUndo present');
ok(appJs.includes('function hideStopUndo'), 'hideStopUndo present');
ok(/setTimeout\(function \(\) \{ u\.hidden = true; stopUndoTimer = null; \}, 10000\)/.test(appJs), 'undo hides itself after 10s');
ok(appJs.includes('arrivedUndoLeft'), 'pre-arrival count is remembered');
ok(/if \(trip\.left < trip\.total\) \{ trip\.left\+\+;/.test(appJs), 'undo restores one stop, capped at the trip total');
ok(appJs.includes("btn-stop-undo"), 'undo button wired');
ok(appJs.includes("btn-arrived-still"), 'still-riding button wired');
ok(/trip\.left = Math\.max\(1, arrivedUndoLeft \|\| 1\)/.test(appJs), 'still-riding restores at least one stop');
ok(/arrivedUndoLeft = trip\.left;/.test(appJs), 'early End trip remembers the live count');
ok(!/speechSynthesis/.test(appJs), 'no speechSynthesis anywhere in app.js (voice removed v35)');

console.log('styles + version:');
ok(css.includes('.linklike[hidden]'), 'linklike hidden guard exists (display:block was defeating hidden)');
ok(html.includes('version 48'), 'About reads version 48');
ok(/var CACHE = 'iht-v48'/.test(sw), 'sw.js cache is iht-v48');

/* Live boot check: start a real trip through the UI, then tap / undo / bounce / false-arrive. */
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
function click(d, sel) { const el = d.querySelector(sel); if (!el) { throw new Error('missing ' + sel); } el.click(); return el; }
function left(d) { return d.getElementById('stops-left').textContent; }
async function startTrip(d) {
  ok(active(d) === 'screen-splash', 'cold boot shows the splash first');
  await sleep(2400); // splash dismisses to home on its own timer
  ok(active(d) === 'screen-home', 'splash dismisses to home');
  click(d, '#btn-start-ride');
  ok(active(d) === 'screen-checkin', 'Start a ride reaches the check-in');
  click(d, '#screen-checkin .feelbtn[data-feel="steady"]');
  click(d, '#btn-checkin-continue');
  ok(active(d) === 'screen-checklist', 'Continue reaches the checklist');
  click(d, '#screen-checklist [data-go="screen-setup"]');
  ok(active(d) === 'screen-setup', 'All set reaches ride setup');
  click(d, '#btn-start-trip');
  ok(active(d) === 'screen-trip', 'Start trip reaches the trip screen');
  ok(left(d) === '5', 'trip starts with 5 stops to go');
  ok(d.getElementById('btn-stop-undo').hidden === true, 'undo hidden before any tap');
  ok(d.getElementById('btn-show-map').hidden === true, 'Show the map stays hidden with no map (linklike hidden guard)');
}

(async function live() {
  console.log('live: undo restores one stop, never past the total:');
  const PROD = 'https://i-hate-trains-aaryan0909s-projects.vercel.app/';
  let t = build(PROD, true);
  await startTrip(t.d);
  click(t.d, '#btn-stop-tap');
  ok(left(t.d) === '4', 'one tap: 5 stops -> 4');
  ok(t.d.getElementById('btn-stop-undo').hidden === false, 'undo appears after a tap');
  click(t.d, '#btn-stop-undo');
  ok(left(t.d) === '5', 'undo: 4 stops -> 5');
  ok(t.d.getElementById('btn-stop-undo').hidden === true, 'undo hides after use');
  ok(t.d.getElementById('stops-word').textContent === 'stops to go', 'plural label restored at 5');

  console.log('live: a rapid double-tap counts once:');
  await sleep(800); // let the previous tap leave the 700ms debounce window first
  click(t.d, '#btn-stop-tap');
  click(t.d, '#btn-stop-tap'); // same tick: a bounce, not a stop
  ok(left(t.d) === '4', 'double-tap in one tick drops the count once, not twice');
  await sleep(800); // past the 700ms debounce window
  click(t.d, '#btn-stop-tap');
  ok(left(t.d) === '3', 'a tap after the window counts again');
  click(t.d, '#btn-stop-undo');
  ok(left(t.d) === '4', 'undo after the debounce sequence still restores one');
  ok(left(t.d) !== '6', 'undo never exceeds the trip total');

  console.log('live: false arrival is recoverable from the arrived screen:');
  await sleep(800);
  click(t.d, '#btn-stop-tap'); // 4 -> 3
  await sleep(800);
  click(t.d, '#btn-stop-tap'); // 3 -> 2
  await sleep(800);
  click(t.d, '#btn-stop-tap'); // 2 -> 1
  ok(left(t.d) === '1', 'counted down to the last stop');
  ok(t.d.getElementById('stops-word').textContent === 'stop to go', 'singular label at 1');
  await sleep(800);
  click(t.d, '#btn-stop-tap'); // 1 -> 0: the mistaken final tap
  await sleep(900); // past the 600ms arrival transition
  ok(active(t.d) === 'screen-arrived', 'count hitting 0 declares arrival');
  click(t.d, '#btn-arrived-still');
  ok(active(t.d) === 'screen-trip', 'still-riding returns to the trip screen');
  ok(left(t.d) === '1', 'still-riding restores 1 stop to go, not 0');
  ok(t.d.getElementById('stops-word').textContent === 'stop to go', 'singular label restored with the count');

  console.log('live: ending early is recoverable too:');
  click(t.d, '#btn-end-trip');
  ok(active(t.d) === 'screen-arrived', 'End trip reaches the arrived screen');
  click(t.d, '#btn-arrived-still');
  ok(active(t.d) === 'screen-trip', 'still-riding returns after an early end');
  ok(left(t.d) === '1', 'early-end recovery keeps the live count (1), not a reset');
  await sleep(800);
  click(t.d, '#btn-stop-tap'); // 1 -> 0, genuine this time
  await sleep(900);
  ok(active(t.d) === 'screen-arrived', 'final tap still declares arrival');
  click(t.d, '#btn-im-home');
  ok(active(t.d) === 'screen-reflect', 'I\'m off still reaches the reflection screen');

  console.log('live: undo hides itself after 10s:');
  const t2 = build(PROD, true);
  await startTrip(t2.d);
  click(t2.d, '#btn-stop-tap');
  ok(t2.d.getElementById('btn-stop-undo').hidden === false, 'undo visible right after a tap');
  await sleep(10500);
  ok(t2.d.getElementById('btn-stop-undo').hidden === true, 'undo hides itself after 10s');
  ok(left(t2.d) === '4', 'the count is untouched by the undo expiring');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('  FAIL harness error: ' + (e && e.stack || e)); process.exit(1); });
