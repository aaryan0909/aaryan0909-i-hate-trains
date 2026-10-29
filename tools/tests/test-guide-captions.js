/* jsdom test for guide.js captions (v38).
   The v35 voice removal left guide.js say() guarded-inert (no __ihtVoice bridge
   anywhere in the app), so the rescue script's instructions reached nobody: the
   screen showed only a phase word ("five…") while #guide-sub sat blank. v38
   renders each script step's full line as a quiet caption under the phase word.
   This test deliberately stubs NO voice bridge: captions must work with voice
   entirely absent. Usage: node tools/tests/test-guide-captions.js
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

// ---- stubs for the bridges app.js normally provides — NO __ihtVoice on purpose
const navLog = [];
let petMounted = false;
w.setTimeout = fakeSetTimeout;
w.clearTimeout = fakeClearTimeout;
w.__ihtGuidePet = { mount: el => { petMounted = !!el; }, name: () => 'Mochi' };
w.__ihtUpdate = { go: id => navLog.push(id) };

const guideSrc = fs.readFileSync(path.join(ROOT, 'guide.js'), 'utf8');
dom.window.eval(guideSrc);

const wordEl = () => w.document.getElementById('guide-word');
const subEl = () => w.document.getElementById('guide-sub');

console.log('caption plumbing exists:');
ok(!!subEl(), '#guide-sub element exists in index.html');
ok(/\.guidesub/.test(fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8')), 'styles.css styles .guidesub');
ok(!/__ihtVoice/.test(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')), 'app.js carries no voice bridge (say() is inert — captions must carry the script)');

console.log('captions track the script with no voice present:');
w.document.getElementById('btn-panic-guide').click();
ok(navLog[0] === 'screen-guide', 'launch navigates to screen-guide');
ok(petMounted, 'pet mounted on launch');
ok(wordEl().textContent === 'You\u2019re okay.', 'first beat word is the acceptance line');
ok(subEl().textContent === 'You\u2019re doing okay. This will pass. Let\u2019s slow down together.', 'acceptance line renders as a caption');
drainOne(); // acceptance hold expires -> breath 1 in
ok(wordEl().textContent === 'breathe in\u2026', 'breath 1: in');
ok(subEl().textContent === '', 'breath beat caption stays blank (the word itself is the instruction)');
drainOne(); // in expires -> breath 1 out
ok(wordEl().textContent === 'and out\u2026', 'breath 1: out');
ok(subEl().textContent === '', 'breath out caption stays blank');
drainAll(); // remaining breaths + grounding + close
ok(wordEl().textContent === 'You did well.', 'script ends on the close line');
ok(subEl().textContent === 'You did well. I\u2019m right here.', 'close line caption persists while the screen waits for "I\'m steadier"');
ok(queue.length === 0, 'no timers left running after the script completes');

console.log('every grounding step captions its instruction:');
w.__ihtGuide.start();
const seen = {};
function stepCaptions() {
  // Walk the script again, recording the caption at each line step.
  for (let i = 0; i < 40 && queue.length; i++) {
    const wText = wordEl().textContent;
    const sText = subEl().textContent;
    if (wText && wText !== 'breathe in\u2026' && wText !== 'and out\u2026') { seen[wText] = sText; }
    drainOne();
  }
}
stepCaptions();
ok(seen['five\u2026'] === 'Five things you can see. Look around, slowly.', 'five step captions its instruction');
ok(seen['four\u2026'] === 'Four things you can touch. Your feet. The seat. Your hands.', 'four step captions its instruction');
ok(seen['three\u2026'] === 'Three things you can hear. They can be quiet, or ordinary.', 'three step captions its instruction');
ok(seen['two\u2026'] === 'Two things you can smell.', 'two step captions its instruction');
ok(seen['one\u2026'] === 'One thing you can taste.', 'one step captions its instruction');

console.log('stop + version markers:');
w.__ihtGuide.start();
w.__ihtGuide.stop();
ok(queue.length === 0, 'stop() clears all pending timers');
ok(/version 39/.test(html), 'About reads version 39');
ok(/var CACHE = 'iht-v39'/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js cache is iht-v39');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
