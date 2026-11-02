/* jsdom test for v43 panic access: a #panic deep link (iOS Shortcut /
   Android home-screen icon, set up from the Privacy screen) lands straight
   on the panic screen, skipping splash, onboarding, and home.
   Usage: node tools/tests/test-panic-access.js (run from tools/tests) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

function build(url, onboarded) {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script src="(drift|trimap|crisis|app|stopheads|guide)\.js"><\/script>/g, '<!-- inlined by test -->');
  const dom = new JSDOM(html, {
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
function show(d, id) { d.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); }); d.getElementById(id).classList.add('active'); }

const PROD = 'https://i-hate-trains-aaryan0909s-projects.vercel.app/';

console.log('deep link, first launch (never onboarded):');
let t1 = build(PROD + '#panic', false);
ok(active(t1.d) === 'screen-panic', '#panic boot lands on screen-panic, not onboarding');
ok(active(t1.d) !== 'screen-splash', 'splash is skipped on a #panic boot');

console.log('deep link, returning user (onboarded):');
let t2 = build(PROD + '#panic', true);
ok(active(t2.d) === 'screen-panic', '#panic boot lands on screen-panic, not home');

console.log('normal boot unaffected:');
let t3 = build(PROD, true);
ok(active(t3.d) === 'screen-splash' || active(t3.d) === 'screen-home', 'no hash: onboarded user boots to splash-then-home, not panic');
let t4 = build(PROD, false);
ok(active(t4.d) !== 'screen-panic', 'no hash: first launch does not land on panic');

console.log('Privacy screen controls:');
let d = t3.d, w = t3.w;
let privacy = d.getElementById('screen-privacy');
ok(!!privacy, 'screen-privacy exists');
ok(privacy.textContent.indexOf('Panic access') !== -1, 'Privacy carries a Panic access section');
ok(privacy.textContent.indexOf('Back Tap') !== -1, 'instructions name Back Tap');
ok(privacy.textContent.indexOf('Add to Home screen') !== -1, 'instructions name Android Add to Home screen');
ok(!!d.getElementById('btn-copy-panic-link'), 'Copy panic link button exists');
ok(!!d.getElementById('btn-try-panic-link'), 'Try it now button exists');
ok(!!d.getElementById('panic-link-hint'), 'panic link hint exists');
show(d, 'screen-privacy');
let copied = null;
w.navigator.clipboard = { writeText: function (t) { copied = t; return Promise.resolve(); } };
d.getElementById('btn-copy-panic-link').click();
ok(copied === PROD + '#panic', 'Copy writes this page + #panic');
d.getElementById('btn-try-panic-link').click();
ok(active(d) === 'screen-panic', 'Try it now lands on screen-panic');

console.log('static markers:');
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(appSrc.indexOf("window.location.hash === '#panic'") !== -1, 'app.js honours #panic at boot and on hashchange');
ok(appSrc.indexOf('btn-copy-panic-link') !== -1, 'app.js wires the copy button');
ok(swSrc.indexOf('iht-v43') !== -1, 'sw.js cache is iht-v43');
ok(htmlSrc.indexOf('version 43') !== -1, 'About reads version 43');
ok(appSrc.indexOf('iht_panic') === -1, 'no new storage key introduced for panic access');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
