/* jsdom test for v36 re-entry beat: after "I'm feeling steadier" (breathe or
   guided rescue, both launched from panic) the rider lands on screen-reentry —
   pet calm, "That took work. You're still here.", one primary action back
   home (or to the ride when a trip is running) — instead of the panic menu.
   Usage: node tools/tests/test-reentry.js (run from tools/tests) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

function makeAudioMock(window) {
  window.AudioContext = function () {
    return {
      createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0 }, type: '' }; },
      createGain() { return { connect() {}, gain: { value: 0 } }; },
      createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; },
      currentTime: 0, destination: {},
    };
  };
}

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<script src="(drift|trimap|crisis|app|stopheads|guide)\.js"><\/script>/g, '<!-- inlined by test -->');
const dom = new JSDOM(html, {
  url: 'https://i-hate-trains-aaryan0909s-projects.vercel.app/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    makeAudioMock(window);
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    window.navigator.geolocation = {
      watchPosition() { return 1; }, clearWatch() {},
      getCurrentPosition(s) { s({ coords: { latitude: 43.65, longitude: -79.38 } }); }
    };
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
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
w.localStorage.setItem('iht_onboarded', '1'); // installed-user state
['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js'].forEach(function (f) {
  w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
});
const d = w.document;
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
function active() { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
function show(id) { d.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); }); d.getElementById(id).classList.add('active'); }

console.log('re-entry screen exists:');
const re = d.getElementById('screen-reentry');
ok(!!re, 'screen-reentry exists');
ok(/That took work\. You'?re still here\./.test(re.textContent), 'copy reads "That took work. You\'re still here."');
ok(!!d.getElementById('pet-reentry'), 're-entry pet mount exists');
ok(!!d.getElementById('btn-reentry-primary'), 'primary button exists');
ok(!!d.getElementById('btn-reentry-options'), 'options door exists');
ok(d.getElementById('btn-reentry-options').textContent.indexOf('show me options again') !== -1, 'options copy is "Not quite — show me options again"');
ok(!!re.querySelector('[data-go="screen-crisis"]'), 'quiet crisis door to screen-crisis exists');

console.log('breathe path (panic origin):');
show('screen-panic');
d.getElementById('btn-panic-breathe').click();
ok(active() === 'screen-breathe', 'panic Breathe opens the breathe screen');
d.getElementById('btn-breathe-end').click();
ok(active() === 'screen-reentry', '"I\'m feeling steadier" lands on screen-reentry, NOT the panic menu');
ok(d.getElementById('btn-reentry-primary').textContent === 'Back home', 'no trip running: primary reads "Back home"');
ok(!!d.getElementById('pet-reentry').innerHTML, 're-entry pet is mounted (not an empty box)');
d.getElementById('btn-reentry-primary').click();
ok(active() === 'screen-home', 'primary returns home');

console.log('guide path (panic origin):');
show('screen-panic');
d.getElementById('btn-panic-guide').click();
ok(active() === 'screen-guide', 'hero opens the guided rescue');
d.getElementById('btn-guide-end').click();
ok(active() === 'screen-reentry', 'guide "I\'m steadier" lands on screen-reentry, NOT the panic menu');
d.getElementById('btn-reentry-options').click();
ok(active() === 'screen-panic', '"Not quite" door returns to the panic menu');
show('screen-reentry');
d.querySelector('#screen-reentry [data-go="screen-crisis"]').click();
ok(active() === 'screen-crisis', 'quiet crisis door opens the crisis screen');

console.log('trip branch (static, trip setup is out of scope for jsdom):');
ok(/reentryTarget = tripActive \? 'screen-trip' : 'screen-home'/.test(appSrc), 'primary target is screen-trip when a trip is running');
ok(/tripActive \? 'Back to my ride' : 'Back home'/.test(appSrc), 'primary label is "Back to my ride" when a trip is running');

console.log('panic menu itself untouched:');
ok(!!d.getElementById('btn-panic-guide'), 'panic hero still present');
ok(!!d.getElementById('crisis-quiet'), 'panic 988 quiet line still present');

console.log('version markers:');
ok(d.getElementById('app-version').textContent.trim() === 'version 36', 'About reads version 36');
ok(/var CACHE = 'iht-v36'/.test(sw), 'sw.js cache is iht-v36');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
