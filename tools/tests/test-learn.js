/* jsdom test for v28 "Calm facts" Learn tab.
   Boots the real index.html + app.js (stubbed audio/geo/network) and exercises:
   home tile -> screen-learn list (5 reads) -> reader view (body, sources,
   tool button) -> back to list. Verifies sacred-flow isolation (no panic-flow
   links), safe-screen + SOS rules, version markers.
   Usage: node tools/tests/test-learn.js  (run from tools/tests) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

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
w.localStorage.setItem('iht_onboarded', '1'); // installed-user state: app boots to screen-home
['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js'].forEach(function (f) {
  w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
});
const d = w.document;
function active() { const a = d.querySelector('.screen.active'); return a ? a.id : null; }

console.log('entry + list:');
const tile = d.querySelector('button[data-go="screen-learn"]');
ok(!!tile, 'home tile with data-go="screen-learn" exists');
ok(!!d.getElementById('screen-learn'), 'screen-learn section exists');
ok(active() === 'screen-home', 'boots on screen-home');
tile.click();
ok(active() === 'screen-learn', 'tile navigates to screen-learn');
const cards = d.querySelectorAll('#learn-list .learnitem');
ok(cards.length === 5, 'learn list renders 5 reads (got ' + cards.length + ')');
ok(Array.prototype.every.call(cards, c => c.querySelector('.lm').textContent === '1 min read'), 'every read labeled 1 min read');
ok(cards[0].querySelector('.lt').textContent === 'The wave peaks, then passes', 'first read title correct');

console.log('reader view:');
cards[0].click();
const read = d.getElementById('learn-read');
ok(d.getElementById('learn-list').hidden && !read.hidden, 'reader replaces the list');
const paras = read.querySelectorAll('p.body');
ok(paras.length === 3, 'first read renders 3 body paragraphs (got ' + paras.length + ')');
const srcParas = read.querySelectorAll('.learnsrc p');
ok(srcParas.length >= 2, 'sources section present with >=2 lines (got ' + srcParas.length + ')');
ok(/DSM-5/.test(read.querySelector('.learnsrc').textContent), 'DSM-5 citation present');
const toolBtn = read.querySelector('button.btn.calm.fullwidth');
ok(!!toolBtn && /Even square breathing/.test(toolBtn.textContent), 'tool button links "Try the tool this explains: Even square breathing"');

console.log('tool button + back navigation:');
toolBtn.click();
ok(active() === 'screen-walk', 'tool button opens the walkthrough tool (screen-walk)');
d.querySelector('#screen-walk [data-go="screen-learn"]') || null; // walk screen has no Learn backlink
d.querySelector('#learn-back-home').click();
ok(active() === 'screen-home', 'screen-learn home backlink returns home');
d.querySelector('button[data-go="screen-learn"]').click();
d.querySelectorAll('#learn-list .learnitem')[1].click();
ok(/5\u20134\u20133\u20132\u20131/.test(d.getElementById('learn-read').textContent), 'second read opens (grounding)');
d.querySelector('#learn-read .backlink').click();
ok(!d.getElementById('learn-list').hidden && d.getElementById('learn-read').hidden, 'all-reads backlink restores the list');
const hooks = Array.prototype.map.call(d.querySelectorAll('#learn-list .learnitem .lh'), e => e.textContent);
ok(hooks.every(h => h.length > 10), 'every read has a standfirst hook');

console.log('sacred-flow isolation:');
const panicHtml = d.getElementById('screen-panic').innerHTML;
ok(panicHtml.indexOf('screen-learn') === -1, 'panic screen carries no link to screen-learn');
const guideHtml = d.getElementById('screen-guide').innerHTML;
ok(guideHtml.indexOf('screen-learn') === -1, 'guide (eyes-free rescue) carries no link to screen-learn');
const breatheHtml = d.getElementById('screen-breathe').innerHTML;
ok(breatheHtml.indexOf('screen-learn') === -1, 'breathe screen carries no link to screen-learn');

console.log('rules + version:');
const safeScreens = w.__ihtUpdate && w.__ihtUpdate.safe;
ok(!!(safeScreens && safeScreens['screen-learn']), 'screen-learn is an update-banner safe screen');
ok(d.getElementById('sos-float').hidden === false, 'SOS float visible on screen-learn (calm screen)');
ok(/iht-v39/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js cache is iht-v39');
ok(/version 39/.test(html), 'About reads "version 39"');
const keys = [];
for (let i = 0; i < w.localStorage.length; i++) { keys.push(w.localStorage.key(i)); }
const learnKeys = keys.filter(k => /learn/i.test(k));
ok(learnKeys.length === 0, 'Learn tab writes no storage keys (got: ' + learnKeys.join(',') + ')');

console.log('tone guard:');
ok(/coping tools, not treatment/.test(d.getElementById('screen-learn').textContent), 'clinical-honesty line present in Learn');
ok(!/premium|paywall|First Class|stripe/i.test(d.getElementById('screen-learn').textContent), 'no monetization copy in Learn');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
