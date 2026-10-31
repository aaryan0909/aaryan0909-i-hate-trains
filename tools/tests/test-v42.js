/* v42 checks: Resume the wave, Make friends with the sensation,
   Body scan (pet-led). Runs calm42.js in jsdom against the real
   index.html (app.js is NOT loaded here, so resume navigation is
   asserted as key-clear + card-hide, not as the app.js panic-button
   handler firing — that handler lives in app.js and is verified by
   the static button-mapping check below).
   Usage: node tools/tests/test-v42.js (run from tools/tests) */
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
function click(el) {
  if (!el) { return; }
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function text(id) { var el = document.getElementById(id); return el ? el.textContent : null; }

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'https://i-hate-trains-aaryan0909s-projects.vercel.app/',
  runScripts: 'outside-only', pretendToBeVisual: true
});
const w = dom.window;
global.document = w.document;
// Sound-pack stub (the real sound.js is grep-checked for no voice below;
// the stub proves calm42 only ever calls motif/tap, never speech).
let tapCalls = 0, motifCalls = 0;
w.__ihtSound = {
  unlock: function () { return true; },
  motif: function () { motifCalls++; return true; },
  tap: function () { tapCalls++; return true; }
};
// Fresh resume record BEFORE calm42 loads (load-time snapshot).
w.localStorage.setItem('iht_resume_wave', JSON.stringify({ tool: 'breathe', phase: 'In', savedAt: Date.now() - 5 * 60 * 1000 }));
w.eval(fs.readFileSync(path.join(ROOT, 'calm42.js'), 'utf8'));
// jsdom has not fired DOMContentLoaded yet at eval time; fire it so wire() runs.
w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
const C = w.__ihtCalm42;

ok(C && C.version === '42', 'calm42 module loads, version 42');
ok(C.key === 'iht_resume_wave', 'resume key is iht_resume_wave (iht_last_ride pattern)');
ok(!document.getElementById('resume-wave-card').hidden, 'resume card shows on home after fresh load with fresh record');
ok((text('resume-wave-cta') || '').indexOf('back to breathing?') !== -1, 'resume CTA reads "back to breathing?" for breathe tool');
click(document.getElementById('resume-wave-dismiss'));
ok(w.localStorage.getItem('iht_resume_wave') === null, 'dismiss clears the resume key');
ok(document.getElementById('resume-wave-card').hidden, 'dismiss hides the resume card');

// Expired record is dropped, never shown.
w.localStorage.setItem('iht_resume_wave', JSON.stringify({ tool: 'grounding', phase: '5 · see', savedAt: Date.now() - 61 * 60 * 1000 }));
ok(C.readResume() === null, 'record older than 1 hour expires');
ok(w.localStorage.getItem('iht_resume_wave') === null, 'expired record is deleted');

// Resume mapping: each tool maps to the panic screen's own button.
const calmSrc = fs.readFileSync(path.join(ROOT, 'calm42.js'), 'utf8');
ok(calmSrc.indexOf("btn: 'btn-panic-breathe'") !== -1, 'breathe resumes via btn-panic-breathe');
ok(calmSrc.indexOf("btn: 'btn-panic-ground'") !== -1, 'grounding resumes via btn-panic-ground');
ok(calmSrc.indexOf("btn: 'btn-panic-guide'") !== -1, 'rescue resumes via btn-panic-guide');
ok(document.getElementById('btn-panic-breathe') && document.getElementById('btn-panic-ground') && document.getElementById('btn-panic-guide'), 'all three panic buttons exist in index.html');
w.localStorage.setItem('iht_resume_wave', JSON.stringify({ tool: 'grounding', phase: '5 · see', savedAt: Date.now() }));
C.resumeNow();
ok(w.localStorage.getItem('iht_resume_wave') === null, 'resume clears the key (no second nag)');

// Panic-screen isolation: nothing new is linked from the panic screen.
const panic = document.getElementById('screen-panic');
ok(panic.querySelectorAll('[data-go="screen-sensation"], [data-go="screen-bodyscan"]').length === 0, 'panic screen has no link to sensation or body scan');
ok(panic.textContent.indexOf('Make friends') === -1 && panic.textContent.indexOf('Body scan') === -1, 'panic screen copy untouched by v42');
ok(document.getElementById('screen-learn').querySelectorAll('[data-go="screen-sensation"], [data-go="screen-bodyscan"]').length === 2, 'Learn screen is the entry for both calm-time tools');

// Sensation flow: pick -> before rating -> exercise -> after rating -> done, ratings never stored.
click(document.querySelector('#screen-learn [data-go="screen-sensation"]'));
ok(document.getElementById('screen-sensation').classList.contains('active'), 'sensation screen opens from Learn');
click(document.querySelector('[data-sen42="breathe-faster"]'));
ok(!document.getElementById('sen42-before').hidden, 'before-rating stage shows after picking an exercise');
const beforeBtns = document.querySelectorAll('#sen42-before-grid .calm42-rate');
ok(beforeBtns.length === 11, 'before rating offers 0-10 (11 buttons)');
click(Array.prototype.find.call(beforeBtns, function (b) { return b.textContent === '6'; }));
ok(!document.getElementById('sen42-do').hidden, 'exercise stage shows after before-rating');
ok(motifCalls >= 1, 'exercise start plays the sound-pack motif (no voice)');
click(document.getElementById('sen42-do-finish'));
ok(!document.getElementById('sen42-after').hidden, 'after-rating stage shows after finishing');
const afterBtns = document.querySelectorAll('#sen42-after-grid .calm42-rate');
click(Array.prototype.find.call(afterBtns, function (b) { return b.textContent === '3'; }));
ok(!document.getElementById('sen42-done').hidden, 'done stage shows after after-rating');
ok((text('sen42-done-text') || '').indexOf('Before: 6') !== -1 && (text('sen42-done-text') || '').indexOf('After: 3') !== -1, 'done text compares before/after without grading');
let ratingStored = false;
for (let i = 0; i < w.localStorage.length; i++) { if (/sen|rating/i.test(w.localStorage.key(i))) { ratingStored = true; } }
ok(!ratingStored, 'no sensation rating is stored in localStorage');

// Body scan: 8 steps, feet to head, chime per step, exit to Learn.
click(document.querySelector('#screen-learn [data-go="screen-bodyscan"]'));
ok(document.getElementById('screen-bodyscan').classList.contains('active'), 'body scan opens from Learn');
ok(text('scan42-title') === 'Feet' && text('scan42-count') === '1 of 8', 'body scan starts at Feet, 1 of 8');
const tapsBefore = tapCalls;
for (let i = 0; i < 7; i++) { click(document.getElementById('scan42-next')); }
ok(text('scan42-title') === 'Whole body' && text('scan42-count') === '8 of 8', 'body scan ends at Whole body, 8 of 8 (feet-to-head order)');
ok(C.scanSteps.map(function (s) { return s.part; }).join(',') === 'Feet,Lower legs,Hands,Arms,Shoulders,Chest and belly,Face and head,Whole body', 'scan step order is feet-to-head');
ok(tapCalls > tapsBefore, 'each body-scan step plays a sound-pack chime');
ok(document.getElementById('scan42-ind').classList.contains('playing'), 'body scan shows a visible playing indicator');
click(document.getElementById('scan42-next'));
ok(document.getElementById('screen-learn').classList.contains('active'), 'body scan Done returns to Learn');

// Static guards: no voice, version markers, targets.
const soundSrc = fs.readFileSync(path.join(ROOT, 'sound.js'), 'utf8');
ok(!/speechSynthesis\s*\.|window\.speechSynthesis|new\s+SpeechSynthesis/.test(calmSrc) && !/speechSynthesis\s*\.|window\.speechSynthesis/.test(soundSrc), 'no speech-synthesis call in calm42.js or sound.js');
ok(html.indexOf('version 42') !== -1, 'index.html About reads version 42');
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
ok(swSrc.indexOf('iht-v42') !== -1 && swSrc.indexOf('calm42.js') !== -1 && swSrc.indexOf('v42.css') !== -1, 'sw.js is iht-v42 and precaches calm42.js + v42.css');
const cssSrc = fs.readFileSync(path.join(ROOT, 'v42.css'), 'utf8');
ok(cssSrc.indexOf('min-height: 48px') !== -1, 'v42 rating buttons are 48px tall');
['screen-sensation', 'screen-bodyscan', 'resume-wave-card', 'sen42-before-grid', 'sen42-after-grid', 'scan42-title', 'scan42-ind'].forEach(function (id) {
  ok(!!document.getElementById(id), 'element #' + id + ' exists');
});

console.log('\nv42: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
