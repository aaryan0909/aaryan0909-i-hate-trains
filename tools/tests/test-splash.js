/* jsdom test for v55 "The opening you can actually hear".
   Boots the real index.html + app.js (stubbed audio/geo/network) and exercises:
   - the splash never runs shorter than 2.0s (the motif is ~1.7s; the old
     0.8s/1.2s frequency caps cut it mid-phrase and read as a flash);
   - the motif is NOT scheduled at cold boot while the AudioContext is
     suspended (iOS/Chrome block audio before a gesture), so it can no
     longer sit silent or fire late after the splash is gone;
   - the first tap anywhere unlocks audio and plays the motif while the
     splash is still up, with the visible ♪ and an Android vibration;
   - a tap to skip (after 1s) unlocks audio and lets the motif ring through
     the transition instead of killing it;
   - the panic button never triggers the motif;
   - warm resume skips the splash entirely, as before.
   The AudioContext stub starts `suspended` and resume() only flips it to
   `running` when window.__gesture is true, mimicking the browser's user-
   activation gate. Usage: node tools/tests/test-splash.js (from project root) */
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

function param() {
  return {
    value: 0,
    setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, cancelScheduledValues() {}
  };
}
function nodeStub() { return { connect() {}, disconnect() {} }; }

function boot(opts) {
  opts = opts || {};
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script src="(drift|trimap|crisis|app|stopheads|guide|sound|calm42|ready|platform)\.js"><\/script>/g, '<!-- inlined by test -->');
  const dom = new JSDOM(html, {
    url: 'https://i-hate-trains-aaryan0909s-projects.vercel.app/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.__oscStarts = 0;
      window.__vibrates = [];
      window.__gesture = false;
      window.AudioContext = function () {
        const ctx = {
          sampleRate: 44100,
          currentTime: 0,
          destination: {},
          state: 'suspended', /* cold open: no gesture yet, iOS/Chrome gate */
          resume() { if (window.__gesture) { this.state = 'running'; } },
          createOscillator() {
            return {
              connect() {},
              start() { window.__oscStarts++; },
              stop() {},
              frequency: { value: 0 }, detune: { value: 0 }, type: ''
            };
          },
          createGain() { return { connect() {}, gain: param() }; },
          createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null, loop: false }; },
          createBiquadFilter() { return { connect() {}, frequency: { value: 0 }, Q: { value: 0 }, type: '' }; },
          createDynamicsCompressor() { return { connect() {}, threshold: { value: 0 }, ratio: { value: 0 } }; },
          createBuffer(ch, len) { return { getChannelData() { return new Float32Array(len); } }; }
        };
        return ctx;
      };
      window.navigator.vibrate = function (p) { window.__vibrates.push(p); return true; };
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
  if (opts.splashSeed) { w.localStorage.setItem('iht_splash', JSON.stringify(opts.splashSeed)); }
  if (opts.warm) { w.sessionStorage.setItem('iht_session', '1'); }
  ['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js', 'sound.js', 'ready.js', 'platform.js'].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  return { w: w, d: w.document };
}
function activeId(d) { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
function tap(el, w) {
  w.__gesture = true; /* a real tap grants user activation */
  el.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
}

(async function main() {
  const today = new Date().toDateString();
  const weekAgo = Date.now() - 8 * 24 * 3600 * 1000;

  /* ---------- A. week-old install: splash floor is 2.0s, motif silent at boot ---------- */
  let env = boot({ splashSeed: { first: weekAgo, date: today, count: 1 } });
  let d = env.d, w = env.w;
  ok(activeId(d) === 'screen-splash', 'cold boot shows the splash first');
  ok(w.__oscStarts === 0, 'no motif scheduled at boot while audio is suspended');
  ok(!d.getElementById('splash-sound').classList.contains('playing'), 'sound indicator hidden while nothing plays');
  await sleep(1500);
  ok(activeId(d) === 'screen-splash', 'week-old install: splash still up at 1.5s (old 0.8s cap is gone)');
  await sleep(800);
  ok(activeId(d) === 'screen-home', 'week-old install: splash dismisses to home by ~2.3s');

  /* ---------- B. first tap plays the deferred motif, with indicator + buzz ---------- */
  env = boot({ splashSeed: { first: weekAgo, date: today, count: 1 } });
  d = env.d; w = env.w;
  ok(activeId(d) === 'screen-splash', 'second boot shows the splash');
  ok(w.__oscStarts === 0, 'still silent before any gesture');
  tap(d.getElementById('screen-splash'), w);
  ok(w.__oscStarts >= 4, 'first tap plays the motif (4 notes + pad scheduled)');
  ok(d.getElementById('splash-sound').classList.contains('playing'), '♪ indicator pulses while the motif sounds');
  ok(w.__vibrates.length >= 1, 'soft vibration fires at the motif start (Android)');
  ok(activeId(d) === 'screen-splash', 'early tap starts the sound without dismissing the splash');

  /* ---------- C. tap to skip after 1s: motif rings through the transition ---------- */
  env = boot({ splashSeed: { first: Date.now(), date: today, count: 1 } });
  d = env.d; w = env.w;
  await sleep(1100); /* past the 1s skip gate */
  ok(activeId(d) === 'screen-splash', 'normal open: splash still up at 1.1s');
  tap(d.getElementById('screen-splash'), w);
  ok(w.__oscStarts >= 4, 'skip tap unlocks audio and plays the motif');
  ok(activeId(d) === 'screen-home', 'skip tap still dismisses to home at once');
  await sleep(1300);
  ok(activeId(d) === 'screen-home', 'normal open: home by ~2.4s (2.2s splash)');

  /* ---------- D. frequent opener: 2.0s floor, not the old 1.2s ---------- */
  env = boot({ splashSeed: { first: Date.now(), date: today, count: 5 } });
  d = env.d; w = env.w;
  await sleep(1500);
  ok(activeId(d) === 'screen-splash', 'frequent opener: splash still up at 1.5s (old 1.2s cap is gone)');
  await sleep(800);
  ok(activeId(d) === 'screen-home', 'frequent opener: splash dismisses to home by ~2.3s');

  /* ---------- E. panic button: no motif, straight to help ---------- */
  env = boot({ splashSeed: { first: weekAgo, date: today, count: 1 } });
  d = env.d; w = env.w;
  w.__gesture = true;
  d.getElementById('btn-splash-panic').dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  ok(w.__oscStarts === 0, 'panic tap never triggers the motif');
  d.getElementById('btn-splash-panic').click();
  ok(activeId(d) === 'screen-panic', 'panic button goes straight to the panic screen');

  /* ---------- F. warm resume: no splash, no motif ---------- */
  env = boot({ warm: true });
  d = env.d; w = env.w;
  ok(activeId(d) === 'screen-home', 'warm resume skips the splash entirely');
  ok(w.__oscStarts === 0, 'warm resume plays no motif');

  /* ---------- G. version markers ---------- */
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(sw.indexOf('iht-v56') !== -1, 'sw.js carries iht-v56');
  ok(html.indexOf('version 56') !== -1, 'About reads version 56');
  ok(html.indexOf('id="splash-sound"') !== -1, 'splash sound indicator is in the markup');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
