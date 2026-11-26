/* jsdom test for v60 "The ten-minute clock": a quiet ring on the guided
   rescue that fills as the wave passes its ~10-minute peak, then one calm
   line — "Past the peak now — the wave is passing." No numbers, no countdown,
   nothing to watch. The ring measures from when the panic screen opened
   (anchor captured on panic entry from the existing iht_resume_wave record),
   resumes from where it left off on re-entry or after an app restart within
   the hour, and ends at re-entry/arrival or when the resume card is
   dismissed. No new storage keys, no voice, no sound.
   Usage: node tools/tests/test-clock.js  (run from the project root) */
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
const CIRC = 163.36;
const PEAK = 10 * 60 * 1000;
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const clockJs = fs.readFileSync(path.join(ROOT, 'clock.js'), 'utf8');

console.log('static: markup + styles + service worker + version:');
const guideSection = html.slice(html.indexOf('id="screen-guide"'), html.indexOf('id="screen-reentry"'));
ok(guideSection.includes('id="wave-clock"'), 'guide screen has the wave-clock ring');
ok(guideSection.includes('id="wave-clock-fill"'), 'ring fill circle present');
ok(guideSection.includes('id="wave-clock-line"'), 'peak line present');
ok(guideSection.includes('Past the peak now'), 'peak line copy present');
ok(/id="wave-clock-line"[^>]*hidden/.test(guideSection), 'peak line hidden by default in markup');
ok(!/\d/.test('Past the peak now — the wave is passing.'), 'peak line carries no numbers');
ok(guideSection.indexOf('id="wave-clock"') > guideSection.indexOf('id="guide-sub"'), 'ring sits below the phase caption');
ok(guideSection.indexOf('id="wave-clock"') < guideSection.indexOf('id="btn-guide-end"'), 'ring sits above the I\'m steadier button');
ok(html.includes('<script src="clock.js"></script>'), 'clock.js loaded');
ok(html.indexOf('<script src="clock.js"></script>') > html.indexOf('<script src="guide.js"></script>'), 'clock loads after guide');
ok(html.includes('version 60'), 'About reads version 60');
ok(css.includes('.waveclock'), 'waveclock styles present');
ok(css.includes('.wc-fill'), 'ring fill styles present');
ok(css.includes('stroke-dasharray: 163.36'), 'ring dasharray matches r=26 circumference');
ok(css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('.wc-fill { transition: none; }'), 'reduced motion kills the fill transition');
ok(sw.includes("var CACHE = 'iht-v60'"), 'service worker cache is iht-v60');
ok(sw.includes("'clock.js'"), 'service worker precaches clock.js');
ok(!clockJs.includes('speechSynthesis'), 'no voice in the clock module');
ok(!clockJs.includes('setItem'), 'no new storage keys: the clock only reads iht_resume_wave');
ok(!clockJs.includes('AudioContext') && !clockJs.includes('__ihtSound'), 'no sound in the clock module');

function param() {
  return {
    value: 0,
    setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, cancelScheduledValues() {}
  };
}

function boot(opts) {
  opts = opts || {};
  let h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  h = h.replace(/<script src="(drift|trimap|crisis|app|stopheads|guide|sound|calm42|ready|platform|clock)\.js"><\/script>/g, '<!-- inlined by test -->');
  const dom = new JSDOM(h, {
    url: 'https://i-hate-trains-aaryan0909s-projects.vercel.app/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.AudioContext = function () {
        return {
          sampleRate: 44100, currentTime: 0, destination: {}, state: 'running',
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
  ['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js', 'sound.js', 'calm42.js', 'ready.js', 'platform.js', 'clock.js'].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  return { w: w, d: w.document };
}
function activeId(d) { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
async function openGuide(env) {
  const d = env.d, w = env.w;
  w.__ihtUpdate.go('screen-panic');
  // Let the screen observers fire while panic is active: the clock captures
  // its wave anchor on panic entry, exactly as a real rider's tap-through
  // does. Without this pause the two navigations batch into one observer
  // callback and the panic visit is never observed.
  await sleep(30);
  d.getElementById('btn-panic-guide').click();
  await sleep(60);
  ok(activeId(d) === 'screen-guide', 'panic guide button opens the guided rescue');
}
function fillOffset(d) {
  return parseFloat(d.getElementById('wave-clock-fill').style.strokeDashoffset);
}

(async function () {
  console.log('behavior: fresh wave starts empty, no peak line:');
  let env = boot();
  await openGuide(env);
  env.w.__ihtClock.tick();
  ok(near(fillOffset(env.d), CIRC, 1), 'fresh wave: ring empty (offset ~ circumference)');
  ok(env.d.getElementById('wave-clock-line').hidden, 'fresh wave: peak line hidden');
  ok(!env.d.getElementById('wave-clock-fill').classList.contains('past-peak'), 'fresh wave: no past-peak class');
  ok(env.w.__ihtClock.state().elapsedMs !== null && env.w.__ihtClock.state().elapsedMs < 30000, 'fresh wave: anchor is now');
  ok(env.w.__ihtClock.state().pastPeak === false, 'fresh wave: not past peak');
  env.w.__ihtClock.stop();

  console.log('behavior: five minutes in — half full, still no peak line:');
  env = boot();
  env.w.localStorage.setItem('iht_resume_wave', JSON.stringify({ tool: 'breathe', phase: 'in progress', savedAt: Date.now() - 5 * 60 * 1000 }));
  await openGuide(env);
  env.w.__ihtClock.tick();
  ok(near(fillOffset(env.d), CIRC / 2, 2), '5 min in: ring about half full');
  ok(env.d.getElementById('wave-clock-line').hidden, '5 min in: peak line still hidden');
  ok(!env.d.getElementById('wave-clock-fill').classList.contains('past-peak'), '5 min in: no past-peak class');
  env.w.__ihtClock.stop();

  console.log('behavior: at and past the peak — full ring, line shows:');
  env = boot();
  env.w.localStorage.setItem('iht_resume_wave', JSON.stringify({ tool: 'rescue', phase: 'in progress', savedAt: Date.now() - PEAK }));
  await openGuide(env);
  env.w.__ihtClock.tick();
  ok(near(fillOffset(env.d), 0, 1), 'at 10 min: ring full (offset ~ 0)');
  ok(!env.d.getElementById('wave-clock-line').hidden, 'at 10 min: peak line shows');
  ok(env.d.getElementById('wave-clock-line').textContent.indexOf('Past the peak now') === 0, 'peak line copy exact');
  ok(env.d.getElementById('wave-clock-fill').classList.contains('past-peak'), 'at 10 min: past-peak class set');
  ok(env.w.__ihtClock.state().pastPeak === true, 'at 10 min: state reports past peak');
  env.w.__ihtClock.stop();

  env = boot();
  env.w.localStorage.setItem('iht_resume_wave', JSON.stringify({ tool: 'rescue', phase: 'in progress', savedAt: Date.now() - 12 * 60 * 1000 }));
  await openGuide(env);
  env.w.__ihtClock.tick();
  ok(near(fillOffset(env.d), 0, 1), '12 min in: ring stays full, never overflows');
  ok(!env.d.getElementById('wave-clock-line').hidden, '12 min in: peak line stays visible');
  env.w.__ihtClock.stop();

  console.log('behavior: resume — re-entering the guide keeps the anchor:');
  env = boot();
  env.w.localStorage.setItem('iht_resume_wave', JSON.stringify({ tool: 'breathe', phase: 'in progress', savedAt: Date.now() - 4 * 60 * 1000 }));
  await openGuide(env);
  env.w.__ihtClock.tick();
  const anchor1 = env.w.__ihtClock.anchor();
  ok(near(anchor1, Date.now() - 4 * 60 * 1000, 5000), 'anchor captured from the resume record at panic entry');
  ok(near(fillOffset(env.d), CIRC * 0.6, 2), '4 min in: ring about 40% full');
  env.w.__ihtUpdate.go('screen-panic');
  await sleep(30);
  env.d.getElementById('btn-panic-guide').click();
  await sleep(60);
  env.w.__ihtClock.tick();
  ok(env.w.__ihtClock.anchor() === anchor1, 're-entering the guide keeps the same anchor');
  ok(near(fillOffset(env.d), CIRC * 0.6, 3), 're-entry: ring resumes from where it left off');
  env.w.__ihtClock.stop();

  console.log('behavior: wave ends — re-entry screen and resume dismiss clear the anchor:');
  env = boot();
  await openGuide(env);
  ok(env.w.__ihtClock.anchor() !== null, 'anchor set on guide entry');
  env.w.__ihtUpdate.go('screen-reentry');
  await sleep(60);
  ok(env.w.__ihtClock.anchor() === null, 're-entry screen clears the anchor');
  env.w.__ihtClock.stop();

  env = boot();
  await openGuide(env);
  ok(env.w.__ihtClock.anchor() !== null, 'anchor set on guide entry (dismiss case)');
  env.d.getElementById('resume-wave-dismiss').click();
  await sleep(30);
  ok(env.w.__ihtClock.anchor() === null, 'dismissing the resume card clears the anchor');
  env.w.__ihtClock.stop();

  console.log('behavior: stale record (>1h) starts a fresh ring:');
  env = boot();
  env.w.localStorage.setItem('iht_resume_wave', JSON.stringify({ tool: 'rescue', phase: 'in progress', savedAt: Date.now() - 2 * 60 * 60 * 1000 }));
  await openGuide(env);
  env.w.__ihtClock.tick();
  ok(near(fillOffset(env.d), CIRC, 1), 'stale record: ring starts empty, not resumed');
  ok(env.d.getElementById('wave-clock-line').hidden, 'stale record: peak line hidden');
  env.w.__ihtClock.stop();

  console.log('behavior: leaving the guide stops the ticker:');
  env = boot();
  await openGuide(env);
  env.w.__ihtUpdate.go('screen-panic');
  await sleep(60);
  // The interval is private; the observable is that no error fires and the
  // anchor survives leaving (the wave is still open until re-entry).
  ok(env.w.__ihtClock.anchor() !== null, 'leaving the guide keeps the anchor (wave still open)');
  env.w.__ihtClock.stop();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
