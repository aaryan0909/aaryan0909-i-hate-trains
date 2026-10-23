/* jsdom test for guide.js (v27 "Talk me through it").
   Loads the real index.html, stubs the app.js bridges (voice, pet, nav), and steps
   through the rescue script with a fake timer. Usage: node tools/tests/test-guide.js
   Requires: npm install jsdom (once, in tools/tests). */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

// ---- fake timer: queue callbacks, drain one at a time for deterministic stepping
let queue = [];
function fakeSetTimeout(fn, ms) { const id = queue.length + 1; queue.push({ id, fn, ms }); return id; }
function fakeClearTimeout(id) { queue = queue.filter(q => q.id !== id); }
function drainOne() { const q = queue.shift(); if (q) { q.fn(); return true; } return false; }
function drainAll(limit) { let n = 0; while (drainOne() && n < (limit || 200)) { n++; } return n; }

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only' });
const w = dom.window;

// ---- stubs for the bridges app.js normally provides
const spoken = [];
const navLog = [];
let petMounted = false;
w.setTimeout = fakeSetTimeout;
w.clearTimeout = fakeClearTimeout;
w.__ihtVoice = {
  speak: t => spoken.push(t),
  stop: () => spoken.push('[voice-stop]')
};
w.__ihtGuidePet = {
  mount: el => { petMounted = !!el; },
  name: () => 'Mochi'
};
w.__ihtUpdate = { go: id => navLog.push(id) };

// ---- load the module under test
const guideSrc = fs.readFileSync(path.join(ROOT, 'guide.js'), 'utf8');
dom.window.eval(guideSrc);

console.log('guide.js module surface:');
ok(typeof w.__ihtGuide === 'object', 'exposes window.__ihtGuide');
ok(typeof w.__ihtGuide.start === 'function' && typeof w.__ihtGuide.stop === 'function', 'start/stop functions exist');

console.log('launch wiring:');
const launchBtn = w.document.getElementById('btn-panic-guide');
ok(!!launchBtn, 'panic screen carries #btn-panic-guide');
ok(launchBtn && launchBtn.classList.contains('po-guide'), 'guide button is visually distinct (po-guide)');
ok(!!w.document.getElementById('screen-guide'), 'screen-guide section exists');
ok(!!w.document.getElementById('guide-pet') && !!w.document.getElementById('guide-word') && !!w.document.getElementById('btn-guide-end'), 'guide pet/word/end button exist');
ok(w.document.querySelector('script[src="guide.js"]') !== null, 'index.html loads guide.js');
ok(/guide\.js/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js precaches guide.js');
ok(/iht-v29/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js cache is iht-v29');

console.log('rescue script sequence:');
launchBtn.click();
ok(navLog[0] === 'screen-guide', 'launch navigates to screen-guide');
ok(petMounted, 'pet mounted on launch');
ok(w.document.getElementById('guide-word').textContent === 'You\u2019re okay.', 'first beat is the acceptance line');
ok(spoken.some(t => t === 'You\u2019re doing okay. This will pass. Let\u2019s slow down together.'), 'voice speaks the acceptance line inside the launch gesture');

drainOne(); // acceptance hold expires -> breath 1 in
const wordEl = w.document.getElementById('guide-word');
ok(wordEl.textContent === 'breathe in\u2026', 'breath 1: in');
ok(w.document.getElementById('guide-pet').style.transform === 'scale(1.35)', 'pet visibly inhales (scale 1.35)');
drainOne(); // in expires -> breath 1 out
ok(wordEl.textContent === 'and out\u2026', 'breath 1: out');
ok(w.document.getElementById('guide-pet').style.transform === 'scale(1)', 'pet exhales back');
drainOne(); // breath 1 done -> breath 2
ok(wordEl.textContent === 'breathe in\u2026', 'breath 2 starts');
drainAll(); // run the remaining breaths + grounding + close
ok(wordEl.textContent === 'You did well.', 'script ends on the close line');
ok(spoken[spoken.length - 1] === 'You did well. I\u2019m right here.', 'voice speaks the close line');
ok(spoken.some(t => /Five things you can see/.test(t)), '5-4-3-2-1 grounding is spoken (5)');
ok(spoken.some(t => /One thing you can taste/.test(t)), '5-4-3-2-1 grounding is spoken (1)');
ok(queue.length === 0, 'no timers left running after the script completes');

console.log('end + stop behavior:');
const before = spoken.length;
w.__ihtGuide.start();
w.__ihtGuide.stop();
ok(spoken[spoken.length - 1] === '[voice-stop]', 'stop() silences the voice');
ok(queue.length === 0, 'stop() clears all pending timers');
const endBtn = w.document.getElementById('btn-guide-end');
endBtn.click();
ok(navLog[navLog.length - 1] === 'screen-panic', 'end button returns to the panic screen');
ok(endBtn.classList.contains('fullwidth'), 'end button is full-width');

console.log('app.js hooks:');
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
ok(/'screen-guide': 1/.test(appSrc), 'screen-guide hides the SOS float');
ok(/__ihtGuide\.stop\(\)/.test(appSrc), 'go() stops the guide when leaving the screen');
ok(/__ihtGuidePet/.test(appSrc), 'app.js exposes the pet bridge for guide.js');

console.log('copy + sacred-flow discipline:');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
ok(/#screen-guide \.rise/.test(css) && /animation: none/.test(css), 'guide screen kills entrance-animation delays');
ok(/#screen-guide\.eyefree/.test(css), 'guide screen is near-black (eyefree)');
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(/version 29/.test(idx), 'About reads version 29');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
