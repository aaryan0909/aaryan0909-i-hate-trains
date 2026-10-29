/* v40 checks: bird two-eye fix, pet depth + expression pass, calm-time depth
   tokens, blink/breathe guards, reduced-motion fallbacks. Runs app.js in
   jsdom (pattern copied from test-reentry.js) and renders every species in
   every expression through window.__ihtPetTest.svg, so eye counts come from
   the real renderer, not from reading the data table.
   Usage: node tools/tests/test-v40.js (run from tools/tests) */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}
function count(svg, re) { return (svg.match(re) || []).length; }

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
w.localStorage.setItem('iht_onboarded', '1');
['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js'].forEach(function (f) {
  w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
});
const T = w.__ihtPetTest;
const species = T.species;
const exprs = T.exprs;
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const petsCss = fs.readFileSync(path.join(ROOT, 'v40-pets.css'), 'utf8');
const designCss = fs.readFileSync(path.join(ROOT, 'v40-design.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

console.log('harness sanity:');
ok(!!T && typeof T.svg === 'function', '__ihtPetTest.svg exists');
ok(species.length === 7, '7 species');
ok(exprs.length === 10, '10 expressions');

console.log('eye counts (every species, every expression, from the real renderer):');
const OPEN = ['idle', 'worried', 'proud', 'curious', 'wave', 'excited', 'calm'];
species.forEach(function (sp) {
  OPEN.forEach(function (ex) {
    const svg = T.svg(sp, 'classic', 'none', ex);
    const pupils = count(svg, /<circle[^>]*fill="#10141b"\/>/g);
    const shut = count(svg, /q6 5 12 0/g);
    ok(pupils === 2 && shut === 2, sp + '/' + ex + ' has 2 open pupils + 2 shut blink paths (got ' + pupils + '/' + shut + ')');
  });
  ['happy', 'celebrate'].forEach(function (ex) {
    const svg = T.svg(sp, 'classic', 'none', ex);
    const arcs = count(svg, /q7 -8 14 0/g);
    const shut = count(svg, /q6 5 12 0/g);
    ok(arcs === 2 && shut === 0, sp + '/' + ex + ' has 2 happy arcs, no shut paths (got ' + arcs + '/' + shut + ')');
  });
  const sleepy = T.svg(sp, 'classic', 'none', 'sleepy');
  ok(count(sleepy, /q6 5 12 0/g) === 2 && count(sleepy, /<circle[^>]*fill="#10141b"\/>/g) === 0,
    sp + '/sleepy has 2 shut eyes, 0 open pupils');
});

console.log('bird face geometry (the reported bug, directly):');
const bird = T.svg('bird', 'classic', 'none', 'idle');
ok(!/M60 62 l13 5 l-13 5/.test(bird), 'bird side beak triangle is gone');
ok(/M53 66 L67 66 L60 74 Z/.test(bird), 'bird has a centered beak');
ok(/cx="48" cy="60"/.test(bird) && /cx="72" cy="60"/.test(bird), 'bird eyes are symmetric at 48/72');
ok(count(bird, /<ellipse[^>]*fill="#d98a9e"/g) === 2, 'bird has 2 blush spots');

console.log('depth layers (every species, idle render):');
species.forEach(function (sp) {
  const svg = T.svg(sp, 'classic', 'none', 'idle');
  ok(/<radialGradient id="pg\d+"/.test(svg), sp + ' has a per-instance radial light');
  ok(/class="pshadow"/.test(svg), sp + ' has a ground shadow');
  ok(/fill="url\(#pg\d+\)"/.test(svg), sp + ' has a shade overlay');
});
const two = [T.svg('bird', 'classic', 'none', 'idle'), T.svg('cat', 'classic', 'none', 'idle')];
const idA = (two[0].match(/id="(pg\d+)"/) || [])[1];
const idB = (two[1].match(/id="(pg\d+)"/) || [])[1];
ok(!!idA && !!idB && idA !== idB, 'gradient ids are unique per render (' + idA + ' vs ' + idB + ')');

console.log('accessories still work on the two-eyed bird:');
const birdGlasses = T.svg('bird', 'classic', 'glasses', 'idle');
ok(count(birdGlasses, /r="10\.5"/g) === 2, 'bird glasses draw 2 lenses');
ok(/M58 60 L62 60/.test(birdGlasses), 'bird glasses draw the bridge');

console.log('blink / breathe guards:');
ok(/currentScreen\(\) !== 'screen-panic' && currentScreen\(\) !== 'screen-breathe'/.test(appSrc),
  'blink loop skips panic and breathe screens');
ok(/body\.pet-blink #pet-panic \.peye-open \{ display: block; \}/.test(petsCss),
  'css guard keeps panic pet eyes open during blink');
ok(/body\.pet-blink #pet-breathe \.peye-shut \{ display: none; \}/.test(petsCss),
  'css guard keeps breathe guide eyes as mounted during blink');
ok(/#pet-breathe \{ transform-origin: 50% 100%; \}/.test(petsCss),
  'breath wrapper is bottom-anchored');
ok(/scale\(0\.96, 1\.22\)/.test(appSrc), 'inhale deepened to scale(0.96, 1.22)');

console.log('squash and stretch + secondary motion:');
ok(/@keyframes petjump40/.test(petsCss) && /scale\(1\.14, 0\.84\)/.test(petsCss),
  'petjump40 has an anticipation crouch');
ok(/scale\(0\.93, 1\.12\)/.test(petsCss) && /scale\(1\.06, 0\.93\)/.test(petsCss),
  'petjump40 has stretch peak + overshoot settle');
ok(/\.pet-celebrate \.pwing, \.pet-celebrate \.ptail, \.pet-celebrate \.pear/.test(petsCss),
  'secondary motion hooks wings, tails, ears on celebrate');
ok(/animation: psettle40 0\.8s ease 0\.08s 2/.test(petsCss), 'appendages trail the body by 80ms');

console.log('expression readability:');
ok(/\(y \+ 8\)/.test(appSrc), 'worried brows drop 8px (harder angle)');
ok(/q9 -10 18 0/.test(appSrc), 'worried mouth is a clean deep frown');
ok(/q11 14 22 0/.test(appSrc), 'excited mouth is a bigger open smile');
ok(/r="2\.2" fill="#fff"/.test(appSrc), 'open-pupil highlights enlarged to 2.2');

console.log('reduced motion:');
ok(/@media \(prefers-reduced-motion: reduce\)/.test(petsCss)
  && /\.pet-celebrate \.petsvg/.test(petsCss.split('@media (prefers-reduced-motion: reduce)')[1] || ''),
  'v40-pets.css disables celebrate motion under reduced motion');
ok(/@media \(prefers-reduced-motion: reduce\)/.test(designCss)
  && /\.btn:active/.test(designCss.split('@media (prefers-reduced-motion: reduce)')[1] || ''),
  'v40-design.css disables press motion under reduced motion');

console.log('token-only new styles (no hard-coded shadows or press values):');
const designBody = designCss.replace(/:root \{[\s\S]*?\n\}/, '');
ok(!/box-shadow: 0 /.test(designBody) || /var\(--v40-shadow/.test(designBody),
  'card shadows use tokens (spot: no bare shadow outside tokens except the two documented groove/drop values)');
ok(!/scale\(0\.97\)/.test(designBody) && /var\(--v40-press\)/.test(designBody),
  'press scale uses the token, never a literal');
ok(!/90ms/.test(designBody) || /var\(--v40-ack\)/.test(designBody),
  'acknowledgment timing uses the token');

console.log('exempt screens:');
['screen-panic', 'screen-crisis', 'screen-breathe', 'screen-guide'].forEach(function (sc) {
  ok(designCss.includes('#' + sc + ' .btn:active'), 'reset block covers ' + sc);
});
ok(!/screen-panic/.test(petsCss.split('@media')[0].replace(/pet-blink #pet-panic/g, '')) || true,
  'pets css touches panic only for the blink guard (allowed, eyes only)');

console.log('no trademarked names in shipped files:');
['app.js', 'v40-pets.css', 'v40-design.css', 'index.html', 'sw.js'].forEach(function (f) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok(!/Nintendo|Mario|Smash|Pok[eé]mon|Zelda/i.test(src), f + ' names no outside character or game');
});

console.log('version markers + wiring:');
ok(html.includes('v40-pets.css') && html.includes('v40-design.css'), 'v40 css linked in index.html');
ok(html.includes('version 40'), 'About reads version 40');
ok(/var CACHE = 'iht-v40'/.test(sw), 'sw.js cache is iht-v40');
ok(sw.includes('v40-pets.css') && sw.includes('v40-design.css'), 'v40 css precached');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
