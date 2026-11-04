/* jsdom test for the v44 spiraling check-in rescue.
   Loads the real index.html and guide.js, stubs the app.js bridges (nav, pet,
   voice), and checks: the check-in "Talk me through it first" button exists and
   is spiraling-only in the app.js wiring, guide start(returnTo) routes "I'm
   steadier" back to the return screen, the panic path (no returnTo) still
   reaches the re-entry screen, and the return is cleared after one use.
   Usage: node tools/tests/test-checkin-guide.js
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

// ---- fake timer (guide.js uses the window timers via its own closure scope;
// the module reads setTimeout from its own global at call time through the
// jsdom window, so stub before eval)
let queue = [];
function fakeSetTimeout(fn, ms) { const id = queue.length + 1; queue.push({ id, fn, ms }); return id; }
function fakeClearTimeout(id) { queue = queue.filter(q => q.id !== id); }

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only' });
const w = dom.window;
w.setTimeout = fakeSetTimeout;
w.clearTimeout = fakeClearTimeout;

const navLog = [];
let reentryShown = false;
w.__ihtVoice = { speak: () => {}, stop: () => {} };
w.__ihtGuidePet = { mount: () => {}, name: () => 'Mochi' };
w.__ihtUpdate = { go: id => navLog.push(id) };
w.__ihtReentry = { show: () => { reentryShown = true; } };

const guideSrc = fs.readFileSync(path.join(ROOT, 'guide.js'), 'utf8');
dom.window.eval(guideSrc);

const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

console.log('check-in button wiring (static, from source):');
const btn = w.document.getElementById('btn-checkin-guide');
ok(!!btn, 'index.html carries #btn-checkin-guide');
ok(!!btn && btn.textContent.trim() === 'Talk me through it first', 'button copy is "Talk me through it first"');
ok(!!btn && btn.hasAttribute('hidden'), 'button starts hidden');
ok(!!w.document.getElementById('checkin-actions'), 'check-in actions container exists');
ok(/btn-checkin-guide'\)\.hidden = checkinFeel !== 'spiraling'/.test(appSrc), 'app.js shows the guide button only for spiraling');
ok(/btn-checkin-breathe'\)\.hidden = checkinFeel !== 'spiraling'/.test(appSrc), 'breathe button still spiraling-only (unchanged)');
ok(/__ihtGuide\.start\('screen-checkin'\)/.test(appSrc), 'check-in guide click starts the guide with screen-checkin return');
ok(/btn-checkin-guide/.test(swSrc) === false, 'no sw.js change needed (guide.js already precached)');
ok(/iht-v44/.test(swSrc), 'sw.js cache bumped to iht-v44');
ok(/version 44/.test(html), 'About reads version 44');

console.log('guide return routing:');
ok(typeof w.__ihtGuide.start === 'function', 'guide exposes start(returnTo)');
const endBtn = w.document.getElementById('btn-guide-end');
ok(!!endBtn, 'guide end button exists');

// checkin path: start with return, end lands back on checkin, not re-entry
navLog.length = 0; reentryShown = false;
w.__ihtGuide.start('screen-checkin');
ok(navLog[navLog.length - 1] === 'screen-guide', 'guide start navigates to screen-guide');
endBtn.click();
ok(navLog[navLog.length - 1] === 'screen-checkin', '"I\'m steadier" from a checkin rescue returns to screen-checkin');
ok(!reentryShown, 're-entry screen NOT shown on the checkin return path');

// return is one-shot: a second end without a fresh start falls back to re-entry
navLog.length = 0; reentryShown = false;
endBtn.click();
ok(reentryShown, 'second end (no fresh start) falls back to the re-entry screen');
ok(!navLog.includes('screen-checkin'), 'no stale checkin return on the second end');

// panic path: start with no return, end reaches re-entry as before
navLog.length = 0; reentryShown = false;
w.__ihtGuide.start();
endBtn.click();
ok(reentryShown, 'panic-path end (no returnTo) still shows the re-entry screen');
ok(!navLog.includes('screen-checkin'), 'panic-path end never routes to checkin');

// guide script itself unchanged: still the v27/v38 sequence (source carries the
// lines as \u2019 escapes, so match the plain-ASCII fragments)
ok(/doing okay/.test(guideSrc) && /Five things you can see/.test(guideSrc), 'guide script text unchanged');
ok(/screen-panic/.test(guideSrc), 'panic fallback still present in guide end handler');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
