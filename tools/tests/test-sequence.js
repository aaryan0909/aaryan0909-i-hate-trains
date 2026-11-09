/* jsdom test for v47 "My rescue sequence": your tools, in your order, one tap.
   Calm-time picker in Privacy saves up to 3 tools; the panic screen gains one
   quiet "Start my sequence" button (hidden until a sequence is saved) that runs
   them back to back with auto-advance, a step pill, and a stop-anytime exit.
   No scores, no streaks, no voice (speechSynthesis removed in v35).
   Usage: node tools/tests/test-sequence.js (run from repo root or tools/tests). */
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

console.log('markup: panic button + progress bar + privacy picker:');
const panicSection = html.slice(html.indexOf('id="screen-panic"'), html.indexOf('id="screen-breathe"'));
ok(panicSection.includes('id="btn-panic-seq"'), 'panic screen has btn-panic-seq');
ok(panicSection.includes('Start my sequence'), 'sequence button copy present');
ok(/id="btn-panic-seq"[^>]*hidden/.test(panicSection), 'sequence button hidden by default in markup');
ok(panicSection.indexOf('id="btn-panic-seq"') > panicSection.indexOf('id="btn-panic-worse"'), 'sequence button sits below the worse door');
ok(panicSection.indexOf('id="btn-panic-seq"') < panicSection.indexOf('id="crisis-quiet"'), 'sequence button sits above the 988 quiet line');
ok(panicSection.indexOf('Talk me through it') < panicSection.indexOf('Breathe with me'), 'tool order unchanged: guide first');
ok(panicSection.indexOf('Breathe with me') < panicSection.indexOf('Ground me instead'), 'tool order unchanged: breathe before ground');
ok(html.includes('id="seq-bar"'), 'seq progress bar exists');
ok(html.includes('id="btn-seq-stop"'), 'stop-sequence button exists');
ok(html.includes('Stop sequence'), 'stop copy present');
ok(html.includes('id="seq-label"'), 'seq step label exists');
const privacySection = html.slice(html.indexOf('id="screen-privacy"'), html.indexOf('id="screen-about"'));
ok(privacySection.includes('My rescue sequence'), 'Privacy carries a My rescue sequence section');
ok(privacySection.includes('id="seq-pick-0"') && privacySection.includes('id="seq-pick-1"') && privacySection.includes('id="seq-pick-2"'), 'three picker slots present');
ok(privacySection.includes('id="btn-seq-save"'), 'save button present');
ok(privacySection.includes('id="btn-seq-clear"'), 'clear button present');
ok(privacySection.includes('id="seq-current"'), 'current-sequence line present');
ok(privacySection.indexOf('My rescue sequence') > privacySection.indexOf('Panic access'), 'sequence section sits after Panic access');

console.log('app.js wiring + safety:');
ok(appJs.includes('iht_rescue_seq'), 'sequence stored under iht_rescue_seq');
ok(appJs.includes('function readSeq'), 'readSeq helper present');
ok(appJs.includes('function startSequence'), 'startSequence present');
ok(appJs.includes('function seqAdvance'), 'seqAdvance present');
ok(appJs.includes('function stopSequence'), 'stopSequence present');
ok(appJs.includes('function seqDone'), 'seqDone exit hook present');
ok(appJs.includes('function seqClose'), 'seqClose exit hook present');
ok(appJs.includes('function syncSeqButton'), 'syncSeqButton present');
ok(appJs.includes('renderPanicPlan'), 'panic entry renders plan');
ok(/renderPanicPlan\(\)[\s\S]{0,120}syncSeqButton/.test(appJs) || appJs.includes('syncSeqButton(); // v47'), 'panic entry syncs the sequence button');
ok(appJs.includes("btn-panic-seq"), 'panic sequence button wired');
ok(appJs.includes("btn-seq-save") && appJs.includes("btn-seq-clear"), 'picker save/clear wired');
ok(appJs.includes("btn-seq-stop"), 'stop button wired');
ok(/seqDone\(walkReturn\)/.test(appJs), 'walk Done advances the sequence');
ok(/seqClose\(walkReturn\)/.test(appJs), 'walk Close stops the sequence');
ok(/seqDone\(ixReturn\)/.test(appJs), 'interactive tool exits advance the sequence');
ok(/seqDone\(gestureReturn\)/.test(appJs), 'gesture tool exits advance the sequence');
ok(/if \(seqActive\) \{ seqAdvance\(\); return; \}/.test(appJs), 'breathe end advances mid-sequence instead of re-entry');
ok(/seqActive && !seqLaunching/.test(appJs), 'navigating away mid-sequence ends it quietly');
ok(/SEQ_TOOL_SCREENS\[currentScreen\(\)\]/.test(appJs), 'stale completion timers cannot yank the rider back');
ok(!/speechSynthesis/.test(appJs), 'no speechSynthesis anywhere in app.js (voice removed v35)');
ok(appJs.includes("id: 'breathe'"), 'breathe is a sequenceable step');
ok(appJs.includes("id: 'five-senses'") && appJs.includes("id: 'kind-words'") && appJs.includes("id: 'butterfly-hug'"), 'ground / kind-words / butterfly are sequenceable steps');

console.log('styles + version:');
ok(css.includes('.seqbar'), 'seqbar style exists');
ok(css.includes('.seqselect'), 'seqselect style exists');
ok(css.includes('.seqbar[hidden]'), 'hidden bar stays hidden (display override guard)');
ok(html.includes('version 47'), 'About reads version 47');
ok(/var CACHE = 'iht-v47'/.test(sw), 'sw.js cache is iht-v47');

/* Live boot check: picker save, panic button, full 3-step run, stop, close, navigate-away. */
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
function setSeq(d, a, b, c) {
  d.getElementById('seq-pick-0').value = a || '';
  d.getElementById('seq-pick-1').value = b || '';
  d.getElementById('seq-pick-2').value = c || '';
  d.getElementById('btn-seq-save').click();
}

(async function live() {
  console.log('live: picker + panic button:');
  const PROD = 'https://i-hate-trains-aaryan0909s-projects.vercel.app/';
  let t = build(PROD + '#panic', true);
  ok(active(t.d) === 'screen-panic', 'boots on screen-panic');
  ok(t.d.getElementById('btn-panic-seq').hidden === true, 'sequence button hidden with nothing saved');
  // Privacy via home: back link, More, Privacy tile.
  click(t.d, '#screen-panic [data-go="screen-home"]');
  ok(active(t.d) === 'screen-home', 'back link reaches home');
  t.d.getElementById('btn-home-more').click();
  click(t.d, '#homenav-more [data-go="screen-privacy"]');
  ok(active(t.d) === 'screen-privacy', 'Privacy opens from home More');
  ok(t.d.getElementById('seq-pick-0').options.length === 14, 'picker offers 13 tools + empty (14 options)');
  setSeq(t.d, 'breathe', 'breathe', 'kind-words');
  ok(t.w.localStorage.getItem('iht_rescue_seq') === '["breathe","kind-words"]', 'save dedups: same tool twice stores once, in order');
  ok(t.d.getElementById('seq-current').textContent.includes('Breathe with me'), 'current line names the saved tools');
  setSeq(t.d, 'breathe', 'five-senses', 'kind-words');
  ok(t.w.localStorage.getItem('iht_rescue_seq') === '["breathe","five-senses","kind-words"]', 'save stores three tools in order');
  ok(t.d.getElementById('seq-current').textContent.includes('5–4–3–2–1 senses'), 'current line shows the middle tool');
  // Back to panic: the button appears.
  click(t.d, '#screen-privacy [data-go="screen-home"]');
  click(t.d, '#screen-home [data-go="screen-panic"]');
  ok(active(t.d) === 'screen-panic', 'back on the panic screen');
  ok(t.d.getElementById('btn-panic-seq').hidden === false, 'sequence button visible once saved');

  console.log('live: full 3-step run with auto-advance:');
  t.d.getElementById('btn-panic-seq').click();
  ok(active(t.d) === 'screen-breathe', 'step 1 starts breathing');
  ok(t.d.getElementById('seq-bar').hidden === false, 'progress bar visible mid-sequence');
  ok(t.d.getElementById('seq-label').textContent === 'Step 1 of 3 · Breathe with me', 'bar reads step 1 of 3');
  t.d.getElementById('btn-breathe-end').click();
  ok(active(t.d) === 'screen-senses', 'breathe end advances to step 2 (senses), not re-entry');
  ok(t.d.getElementById('seq-label').textContent === 'Step 2 of 3 · 5–4–3–2–1 senses', 'bar reads step 2 of 3');
  // Skip to the last senses stage, tap the final dot: the timed completion advances.
  for (let i = 0; i < 4; i++) { t.d.getElementById('btn-sen-skip').click(); }
  ok(t.d.getElementById('sen-stage-label').textContent === '1 · taste', 'skips reach the last senses stage');
  t.d.querySelector('#sen-dots .sendot').click();
  await sleep(2300);
  ok(active(t.d) === 'screen-kindwords', 'senses auto-completion advances to step 3 (kind words)');
  ok(t.d.getElementById('seq-label').textContent === 'Step 3 of 3 · Kind, factual words', 'bar reads step 3 of 3');
  t.d.getElementById('btn-kw-done').click();
  ok(active(t.d) === 'screen-reentry', 'last step ends on the re-entry screen');
  ok(t.d.getElementById('seq-bar').hidden === true, 'progress bar hides when the sequence ends');
  ok(t.w.__ihtSequence.active() === false, 'sequence no longer active after the last step');

  console.log('live: stop-anytime exit:');
  t.d.getElementById('btn-reentry-options').click();
  ok(active(t.d) === 'screen-panic', 're-entry offers the panic options again');
  t.d.getElementById('btn-panic-seq').click();
  ok(active(t.d) === 'screen-breathe', 'sequence restarts from the panic button');
  t.d.getElementById('btn-seq-stop').click();
  ok(active(t.d) === 'screen-reentry', 'Stop sequence lands on re-entry');
  ok(t.d.getElementById('seq-bar').hidden === true, 'bar hides after stop');
  ok(t.w.__ihtSequence.active() === false, 'sequence inactive after stop');

  console.log('live: close stops the sequence (walk tool):');
  t.w.localStorage.setItem('iht_rescue_seq', '["three-three-three","kind-words"]');
  t.d.getElementById('btn-reentry-options').click();
  t.d.getElementById('btn-panic-seq').click();
  ok(active(t.d) === 'screen-walk', 'walk tool starts as step 1');
  ok(t.d.getElementById('seq-label').textContent === 'Step 1 of 2 · 3–3–3 noticing', 'bar reads step 1 of 2');
  t.d.getElementById('btn-walk-close').click();
  ok(active(t.d) === 'screen-reentry', 'Close ends the whole sequence at re-entry');
  ok(t.w.__ihtSequence.active() === false, 'sequence inactive after close');

  console.log('live: navigating away ends the sequence quietly:');
  t.w.localStorage.setItem('iht_rescue_seq', '["five-senses","kind-words"]');
  t.d.getElementById('btn-reentry-options').click();
  t.d.getElementById('btn-panic-seq').click();
  ok(active(t.d) === 'screen-senses', 'senses starts as step 1');
  t.d.getElementById('sos-float').click();
  ok(active(t.d) === 'screen-panic', 'SOS float reaches the panic screen mid-sequence');
  ok(t.d.getElementById('seq-bar').hidden === true, 'bar hides after navigating away');
  ok(t.w.__ihtSequence.active() === false, 'sequence inactive after navigating away');
  ok(t.d.getElementById('btn-panic-seq').hidden === false, 'saved sequence still offers the button after a quiet end');

  console.log('live: stale completion timer cannot yank the rider back:');
  t.d.getElementById('btn-panic-ground').click();
  ok(active(t.d) === 'screen-senses', 'grounding opens senses outside a sequence');
  for (let i = 0; i < 4; i++) { t.d.getElementById('btn-sen-skip').click(); }
  t.d.querySelector('#sen-dots .sendot').click(); // schedules the timed exit
  await sleep(600); // past the 500ms stage advance, before the 1500ms exit
  t.d.getElementById('sos-float').click(); // leave for the panic screen first
  ok(active(t.d) === 'screen-panic', 'left for panic before the timer fired');
  await sleep(1800); // past the 1500ms timed exit
  ok(active(t.d) === 'screen-panic', 'stale timer did not yank the rider off the panic screen');

  console.log('live: no-sequence exits unchanged + corrupt key:');
  t.d.getElementById('btn-panic-breathe').click();
  ok(active(t.d) === 'screen-breathe', 'panic breathe still starts the exercise');
  t.d.getElementById('btn-breathe-end').click();
  ok(active(t.d) === 'screen-reentry', 'breathe end without a sequence still reaches re-entry');
  t.d.getElementById('btn-reentry-options').click();
  t.d.getElementById('btn-panic-ground').click();
  t.d.getElementById('btn-sen-done').click();
  ok(active(t.d) === 'screen-panic', 'senses Done without a sequence still returns to panic');
  t.w.localStorage.setItem('iht_rescue_seq', '{bad json');
  t.d.getElementById('btn-panic-breathe').click();
  t.d.getElementById('btn-breathe-end').click();
  t.d.getElementById('btn-reentry-options').click();
  ok(t.d.getElementById('btn-panic-seq').hidden === true, 'corrupt saved sequence hides the button instead of breaking');
  t.w.localStorage.setItem('iht_rescue_seq', '["nope","breathe","breathe"]');
  t.d.getElementById('btn-panic-breathe').click();
  t.d.getElementById('btn-breathe-end').click();
  t.d.getElementById('btn-reentry-options').click();
  ok(t.d.getElementById('btn-panic-seq').hidden === false, 'unknown ids are dropped, valid ones still offer the button');
  t.w.localStorage.setItem('iht_rescue_seq', '[]');
  t.d.getElementById('btn-panic-breathe').click();
  t.d.getElementById('btn-breathe-end').click();
  t.d.getElementById('btn-reentry-options').click();
  ok(t.d.getElementById('btn-panic-seq').hidden === true, 'empty sequence hides the button again');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('  FAIL harness error: ' + (e && e.stack || e)); process.exit(1); });
