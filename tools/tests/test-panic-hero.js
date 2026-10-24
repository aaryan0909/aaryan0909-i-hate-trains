/* jsdom test for v29 panic-screen hero: "Talk me through it" takes the dominant
   first slot on the panic screen, Breathe > Ground > Cute stay as the calm
   secondary row under a quiet "other ways" divider, and the panic screen
   renders with zero entrance-animation delay (the instant-render repeat).
   Boots the real index.html + app.js (stubbed audio/geo/network) and clicks
   the hero card to prove the guide rescue still launches.
   Usage: node tools/tests/test-panic-hero.js  (run from tools/tests) */
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
w.localStorage.setItem('iht_onboarded', '1'); // installed-user state
['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js'].forEach(function (f) {
  w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
});
const d = w.document;
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
function active() { const a = d.querySelector('.screen.active'); return a ? a.id : null; }

console.log('hero order:');
const hero = d.getElementById('btn-panic-guide');
ok(!!hero, 'btn-panic-guide exists');
ok(hero.classList.contains('po-hero'), 'hero carries the po-hero class');
ok(hero.classList.contains('po-guide'), 'hero keeps the near-black po-guide styling');
const cards = Array.prototype.slice.call(d.querySelectorAll('#screen-panic .panicopt'));
ok(cards.length === 4, 'panic screen carries exactly 4 option cards (got ' + cards.length + ')');
ok(cards[0].id === 'btn-panic-guide', 'hero is the FIRST card in DOM order (above the fold)');
ok(cards[1].id === 'btn-panic-breathe', 'second card is Breathe');
ok(cards[2].id === 'btn-panic-ground', 'third card is Ground');
ok(cards[3].id === 'btn-panic-comfort', 'fourth card is Cute');
const divider = d.querySelector('#screen-panic .po-quiet');
ok(!!divider, '"other ways" quiet divider exists');
ok(/other ways/i.test(divider.textContent), 'divider copy reads "other ways"');
ok(divider.compareDocumentPosition(hero) & 2, 'divider comes after the hero');
ok(divider.compareDocumentPosition(d.getElementById('btn-panic-breathe')) & 4, 'divider comes before the Breathe card');

console.log('sacred flow untouched:');
const crisisQuiet = d.getElementById('crisis-quiet');
ok(!!crisisQuiet, '988 quiet line still present');
ok(crisisQuiet.querySelector('a[href^="tel:"]'), '988 line keeps its tel: link');
const planBtn = d.getElementById('btn-panic-plan');
ok(!!planBtn, '"See my backup plan" still present');
ok(planBtn.textContent === 'See my backup plan', 'backup plan copy unchanged');
ok(crisisQuiet.compareDocumentPosition(d.getElementById('btn-panic-comfort')) & 2, '988 line stays below the tool cards');
ok(planBtn.compareDocumentPosition(crisisQuiet) & 4, 'backup plan stays above the 988 line');
const lede = d.querySelector('#screen-panic .lede');
ok(!!lede && /bearable/.test(lede.textContent), 'reassuring lede copy unchanged');

console.log('instant render:');
ok(/#screen-panic\s+\.rise\s*\{[^}]*animation:\s*none/.test(css), '#screen-panic .rise renders instantly in CSS');
ok(/#screen-panic\s+\.rise\s*\{[^}]*opacity:\s*1/.test(css), 'instant rule sets opacity 1');
ok(/#screen-panic\s+\.rise\s*\{[^}]*transform:\s*none/.test(css), 'instant rule sets transform none');
ok(/\.po-hero\s*\{[^}]*min-height:\s*116px/.test(css), '.po-hero hero sizing present');
ok(/\.po-quiet\s*\{[^}]*text-transform:\s*uppercase/.test(css), '.po-quiet divider styling present');

console.log('hero still launches the rescue:');
const sos = d.getElementById('sos-float');
const panic = d.getElementById('screen-panic');
panic.classList.add('active');
hero.click();
ok(active() === 'screen-guide', 'tapping the hero opens screen-guide');

console.log('version markers:');
ok(d.getElementById('app-version').textContent.trim() === 'version 30', 'About reads version 30');
ok(/var CACHE = 'iht-v30'/.test(sw), 'sw.js cache is iht-v30');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
