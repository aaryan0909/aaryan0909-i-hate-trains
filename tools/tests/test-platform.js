/* jsdom test for v54 "The platform minute".
   Boots the real index.html + app.js (stubbed audio/geo/network) and exercises:
   the setup entry + one-screen flow (pet, looping slow breath, cue word,
   exit line); the ambient pad toggle with visible playing feedback; boarding
   keeps the pad into the trip (trip sound button synced by sound.js) while
   backing out or SOS stops it; the reduced-motion path; version markers;
   no voice, no paywall.
   The AudioContext stub is fuller than test-ready's: ambientStart needs
   createBiquadFilter, createBuffer, gain-param methods and a compressor.
   Usage: node tools/tests/test-platform.js  (run from the project root) */
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
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (fn()) { return true; }
    await sleep(25);
  }
  ok(false, 'timed out waiting for: ' + label);
  return false;
}

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
      window.AudioContext = function () {
        return {
          sampleRate: 44100,
          currentTime: 0,
          destination: {},
          state: 'running',
          resume() {},
          createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0 }, detune: { value: 0 }, type: '' }; },
          createGain() { return { connect() {}, gain: param() }; },
          createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null, loop: false }; },
          createBiquadFilter() { return { connect() {}, frequency: { value: 0 }, Q: { value: 0 }, type: '' }; },
          createDynamicsCompressor() { return { connect() {}, threshold: { value: 0 }, ratio: { value: 0 } }; },
          createBuffer(ch, len) { return { getChannelData() { return new Float32Array(len); } }; }
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
  if (opts.cue !== undefined) { w.localStorage.setItem('iht_ready_cue', opts.cue); }
  ['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js', 'sound.js', 'ready.js', 'platform.js'].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  return { w: w, d: w.document };
}
function activeId(d) { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
function click(el) { el.click(); }
function goSetup(env) {
  const d = env.d;
  click(d.getElementById('btn-start-ride'));
  click(d.querySelector('#screen-checkin .feelbtn[data-feel="steady"]'));
  click(d.getElementById('btn-checkin-continue'));
  click(d.querySelector('#screen-checklist [data-go="screen-setup"]'));
  ok(activeId(d) === 'screen-setup', 'checklist -> ride setup');
}
function openPlatform(env) {
  const d = env.d, w = env.w;
  w.__ihtPlatform.timing.inMs = 10;
  w.__ihtPlatform.timing.outMs = 10;
  click(d.getElementById('btn-platform-start'));
  ok(activeId(d) === 'screen-platform', 'setup entry -> platform screen');
  ok(d.getElementById('pet-platform').innerHTML.length > 0, 'pet mounted on the platform screen');
  ok(d.getElementById('platform-breath-cue').textContent === 'Breathe in\u2026', 'breath cue starts "Breathe in\u2026"');
  ok(d.getElementById('petline-platform').textContent.length > 0, 'pet line renders on the platform screen');
}

(async function main() {
  /* ---------- A. entry, breath loop, exit line, no cue without one ---------- */
  let env = boot();
  let d = env.d, w = env.w;
  goSetup(env);
  ok(!!d.getElementById('btn-platform-start'), 'setup offers the platform minute');
  ok(d.getElementById('btn-platform-start').getAttribute('data-go') === 'screen-platform', 'offer navigates to screen-platform');
  openPlatform(env);
  ok(d.getElementById('platform-cue-line').hidden, 'no saved cue word -> no cue line, nothing invented');
  ok(d.querySelector('#screen-platform .body').textContent.indexOf('You can step off at any stop') !== -1, 'exit line is on the screen');
  await waitFor(function () { return w.__ihtPlatform.state().cue.indexOf('and out') !== -1; }, 'exhale cue');
  ok(w.__ihtPlatform.state().cue.indexOf('and out') !== -1, 'breath cycles to the exhale');
  ok(d.getElementById('platform-pet-wrap').classList.contains('platform-out'), 'pet settles on the exhale');
  await waitFor(function () { return w.__ihtPlatform.state().cue === 'Breathe in\u2026'; }, 'inhale cue again');
  ok(w.__ihtPlatform.state().cue === 'Breathe in\u2026', 'breath loops back to the inhale');
  ok(d.getElementById('platform-ind').textContent === 'Sound off', 'sound starts off');

  /* ---------- B. cue word read-back ---------- */
  env = boot({ cue: 'steady' });
  d = env.d; w = env.w;
  goSetup(env);
  openPlatform(env);
  ok(!d.getElementById('platform-cue-line').hidden, 'saved cue word shows its line');
  ok(d.getElementById('platform-cue-line').textContent === 'Your word: \u201csteady\u201d.', 'cue line reads the saved word');

  /* ---------- C. ambient toggle: audible pad + visible feedback ---------- */
  env = boot();
  d = env.d; w = env.w;
  goSetup(env);
  openPlatform(env);
  click(d.getElementById('btn-platform-sound'));
  ok(w.__ihtPlatform.playing(), 'sound toggle starts the pad');
  ok(d.getElementById('platform-ind').textContent.indexOf('Sound playing') !== -1, 'playing indicator shows while the pad plays');
  ok(d.getElementById('platform-ind').classList.contains('playing'), 'playing dot pulses');
  ok(d.getElementById('btn-platform-sound').getAttribute('aria-pressed') === 'true', 'toggle reports pressed while playing');
  click(d.getElementById('btn-platform-sound'));
  ok(!w.__ihtPlatform.playing(), 'second tap stops the pad');
  ok(d.getElementById('platform-ind').textContent === 'Sound off', 'indicator back to Sound off');

  /* ---------- D. boarding stops the pad; the trip button stays honest ---------- */
  env = boot();
  d = env.d; w = env.w;
  goSetup(env);
  openPlatform(env);
  click(d.getElementById('btn-platform-sound'));
  ok(w.__ihtPlatform.playing(), 'pad on before boarding');
  click(d.getElementById('btn-platform-board'));
  ok(activeId(d) === 'screen-trip', 'board the train -> trip screen');
  ok(!w.__ihtPlatform.playing(), 'pad stops on boarding — the trip screen has its own one-tap sound button');
  ok(d.getElementById('sound-label').textContent === 'Ambient off', 'trip sound button reads Ambient off');
  ok(d.getElementById('trip-ready-line').hidden, 'no ready pick -> trip line stays hidden, no false claim');

  /* ---------- E. backing out stops the pad; SOS stops it too ---------- */
  env = boot();
  d = env.d; w = env.w;
  goSetup(env);
  openPlatform(env);
  click(d.getElementById('btn-platform-sound'));
  ok(w.__ihtPlatform.playing(), 'pad on before backing out');
  click(d.getElementById('btn-platform-back'));
  ok(activeId(d) === 'screen-setup', 'back -> ride setup');
  ok(!w.__ihtPlatform.playing(), 'pad stops when leaving for setup');
  openPlatform(env);
  click(d.getElementById('btn-platform-sound'));
  ok(w.__ihtPlatform.playing(), 'pad on again before SOS');
  click(d.getElementById('sos-float'));
  ok(activeId(d) === 'screen-panic', 'SOS -> panic screen');
  ok(!w.__ihtPlatform.playing(), 'pad stops when leaving for panic');

  /* ---------- F. breath timers die when the screen is left ---------- */
  env = boot();
  d = env.d; w = env.w;
  goSetup(env);
  openPlatform(env);
  await waitFor(function () { return w.__ihtPlatform.state().cue.indexOf('and out') !== -1; }, 'exhale cue');
  click(d.getElementById('btn-platform-back'));
  const cueAfterLeave = w.__ihtPlatform.state().cue;
  await sleep(80);
  ok(w.__ihtPlatform.state().cue === cueAfterLeave, 'no breath timer fires after leaving the screen');

  /* ---------- G. reduced motion: static cue, no swell, no loop ---------- */
  env = boot({ reducedMotion: true });
  d = env.d; w = env.w;
  goSetup(env);
  click(d.getElementById('btn-platform-start'));
  ok(activeId(d) === 'screen-platform', 'reduced motion: platform screen still opens');
  ok(d.getElementById('platform-breath-cue').textContent.indexOf('and out') !== -1, 'reduced motion: static breath cue, no swell');
  ok(!d.getElementById('platform-pet-wrap').classList.contains('platform-in'), 'reduced motion: pet does not swell');
  await sleep(60);
  ok(d.getElementById('platform-breath-cue').textContent.indexOf('and out') !== -1, 'reduced motion: no breath loop');

  /* ---------- H. markers + isolation ---------- */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const platformSrc = fs.readFileSync(path.join(ROOT, 'platform.js'), 'utf8');
  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  ok(html.indexOf('version 54') !== -1, 'About reads "version 54"');
  ok(sw.indexOf('iht-v54') !== -1, 'sw.js cache is iht-v54');
  ok(sw.indexOf("'platform.js'") !== -1, 'sw.js precaches platform.js');
  ok(html.indexOf('<script src="platform.js"></script>') !== -1, 'index.html loads platform.js');
  ok(appSrc.indexOf("'screen-platform': 'pet-platform'") !== -1, 'pet mount map covers the platform screen');
  ok(platformSrc.indexOf('speechSynthesis') === -1, 'no voice code added (speechSynthesis absent)');
  const platformCode = platformSrc.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/Stripe|premium|paywall/i.test(platformCode) === false, 'no paywall/premium/Stripe in the new module (comments stripped)');
  env = boot(); d = env.d;
  ok(d.getElementById('screen-panic').innerHTML.indexOf('platform-') === -1, 'panic screen carries no platform markup');
  ok(d.getElementById('screen-panic').innerHTML.indexOf('platform-cue-line') === -1, 'panic screen carries no cue line');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
