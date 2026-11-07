/* jsdom test for v46 "This feels like something worse": the confront path.
   One quiet door off the panic screen names panic physiology in plain words
   and ends with the crisis screen's medical safety line. Text only: the voice
   system was removed in v35, so no speechSynthesis anywhere.
   Usage: node tools/tests/test-worse.js (run from repo root or tools/tests). */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

console.log('screen + panic-screen door:');
ok(html.includes('id="screen-worse"'), 'screen-worse section exists');
const panicSection = html.slice(html.indexOf('id="screen-panic"'), html.indexOf('id="screen-breathe"'));
ok(panicSection.includes('data-go="screen-worse"'), 'panic screen links to screen-worse');
ok(panicSection.includes('This feels like something worse'), 'door copy present on panic screen');
ok(panicSection.includes('id="btn-panic-worse"'), 'door button has a stable id');
const worseIdx = panicSection.indexOf('data-go="screen-worse"');
const groundIdx = panicSection.indexOf('id="btn-panic-ground"');
const q988Idx = panicSection.indexOf('id="crisis-quiet"');
ok(groundIdx !== -1 && worseIdx > groundIdx, 'door sits below the three tool buttons');
ok(q988Idx !== -1 && worseIdx < q988Idx, 'door sits above the 988 quiet line');
ok(panicSection.indexOf('Talk me through it') < panicSection.indexOf('Breathe with me'), 'tool order unchanged: guide first');
ok(panicSection.indexOf('Breathe with me') < panicSection.indexOf('Ground me instead'), 'tool order unchanged: breathe before ground');

console.log('explainer content:');
const worseSection = html.slice(html.indexOf('id="screen-worse"'), html.indexOf('id="screen-breathe"'));
ok(worseSection.includes('It can feel like danger. It usually isn\'t.'), 'headline present');
ok(worseSection.includes('racing heart is adrenaline'), 'racing heart = adrenaline fact present');
ok(worseSection.includes('fight-or-flight with nothing to fight'), 'tight chest / shaking = fight-or-flight fact present');
ok(worseSection.includes('peaks in about 10 minutes'), 'peak ~10 min fact present');
ok(worseSection.includes('Uncomfortable, not dangerous'), 'uncomfortable-not-dangerous framing present');
ok(worseSection.includes('If symptoms are new, severe, or medically concerning, seek urgent medical help.'), 'medical safety line present (crisis-screen wording)');
ok(!worseSection.includes('speechSynthesis'), 'no voice on the explainer screen');
ok(worseSection.includes('id="pet-worse"'), 'pet mount present');
ok(worseSection.includes('id="petline-worse"'), 'pet line present');

console.log('doors out of the explainer:');
ok(worseSection.includes('id="btn-worse-breathe"'), 'Breathe with me door present (id-wired, starts the exercise)');
ok(appJs.includes("btn-worse-breathe"), 'app.js wires btn-worse-breathe');
ok(/btn-worse-breathe[\s\S]{0,200}startBreathe\('gentle', 'screen-panic', true\)/.test(appJs), 'breathe door starts the minimal panic-path exercise with panic return');
ok(worseSection.includes('data-go="screen-crisis"'), 'reach-someone door present');
ok(worseSection.includes('data-go="screen-panic"'), 'back-to-options door present');
ok(worseSection.includes('Breathe with me'), 'breathe door copy present');
ok(worseSection.includes('If it ever gets really bad: reach someone'), 'crisis door copy present');

console.log('app.js wiring + safety:');
ok(appJs.includes("'screen-worse': 'pet-worse'"), 'PET_SCREEN_MOUNTS mounts pet-worse');
ok(appJs.includes('worse:'), 'PET_SCREEN_LINES carries a worse line');
ok(!/SOS_HIDDEN[^}]*screen-worse/.test(appJs), 'SOS float stays visible on screen-worse (not in SOS_HIDDEN)');
ok(!/UPDATE_SAFE_SCREENS[^}]*screen-worse/.test(appJs), 'no update banner on screen-worse (not a safe screen)');
ok(!/speechSynthesis/.test(appJs), 'no speechSynthesis anywhere in app.js (voice removed v35)');

console.log('styles + version:');
ok(css.includes('.linklike.quiet'), 'quiet linklike style exists for the door');
ok(css.includes('.btn.ghost'), 'ghost button style exists for the breathe door');
ok(html.includes('version 46'), 'About reads version 46');
ok(/var CACHE = 'iht-v46'/.test(sw), 'sw.js cache is iht-v46');

/* Live boot check: the door actually navigates, the SOS float shows, the pet line renders. */
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

console.log('live navigation:');
const PROD = 'https://i-hate-trains-aaryan0909s-projects.vercel.app/';
let t = build(PROD + '#panic', true);
ok(active(t.d) === 'screen-panic', 'boots on screen-panic');
t.d.getElementById('btn-panic-worse').click();
ok(active(t.d) === 'screen-worse', 'door click lands on screen-worse');
ok(t.d.getElementById('sos-float').hidden === false, 'SOS float visible on screen-worse');
const petline = t.d.getElementById('petline-worse');
ok(petline && petline.textContent.length > 0, 'pet line renders on screen-worse');
t.d.querySelector('#screen-worse [data-go="screen-panic"]').click();
ok(active(t.d) === 'screen-panic', 'back door returns to screen-panic');
t.d.getElementById('btn-panic-worse').click();
t.d.getElementById('btn-worse-breathe').click();
ok(active(t.d) === 'screen-breathe', 'breathe door starts the exercise on screen-breathe');
ok(t.d.getElementById('breath-patterns').classList.contains('hidden'), 'panic-path breathe hides the pattern chips (minimal)');
t.d.getElementById('btn-breathe-end').click();
ok(active(t.d) === 'screen-reentry', 'steadier exit from the explainer breathe goes to re-entry, not the panic menu');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
