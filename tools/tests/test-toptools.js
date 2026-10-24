/* jsdom test for v30 "Your most calming tools" home card.
   Boots the real index.html + app.js (stubbed audio/geo/network) and exercises:
   empty journal -> card hidden; seeded journal -> top 3 ranked by ride count
   (ties toward the most recent ride, one count per entry per tool, unknown
   titles ignored); Start opens the tool; corrupt journal hides the card;
   panic screen carries no top-tools markup; version markers.
   Usage: node tools/tests/test-toptools.js  (run from tools/tests) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

function boot(journalValue) {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script src="(drift|trimap|crisis|app|stopheads|guide)\.js"><\/script>/g, '<!-- inlined by test -->');
  const dom = new JSDOM(html, {
    url: 'https://i-hate-trains-aaryan0909s-projects.vercel.app/',
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
  if (journalValue !== undefined) { w.localStorage.setItem('iht_journal', journalValue); }
  ['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js'].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  return { w: w, d: w.document };
}
function active(d) { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
function rows(d) { return Array.prototype.slice.call(d.querySelectorAll('#home-top-tools-list .toptool')); }

console.log('empty journal:');
let t = boot(undefined);
ok(active(t.d) === 'screen-home', 'boots on screen-home');
ok(t.d.getElementById('home-top-tools').hidden === true, 'card hidden with no journal');
ok(rows(t.d).length === 0, 'no rows with no journal');

console.log('seeded journal ranking:');
const seeded = JSON.stringify([
  { t: '2026-10-20T10:00:00Z', tools: ['5–4–3–2–1 senses', 'Butterfly taps'] },
  { t: '2026-10-21T10:00:00Z', tools: ['5–4–3–2–1 senses'] },
  { t: '2026-10-22T10:00:00Z', tools: ['Kind, factual words'] },
  { t: '2026-10-23T10:00:00Z', tools: ['Not a real tool'] },
  { t: '2026-10-23T11:00:00Z', tools: [] },
  { t: '2026-10-24T10:00:00Z', tools: ['Butterfly taps', 'Butterfly taps'] },
]);
t = boot(seeded);
ok(t.d.getElementById('home-top-tools').hidden === false, 'card shown with journal data');
const r = rows(t.d);
ok(r.length === 3, 'top 3 only (got ' + r.length + ')');
ok(r[0].textContent.indexOf('Butterfly taps') !== -1, 'tie broken toward most recent: Butterfly first');
ok(r[0].textContent.indexOf('2 rides') !== -1, 'Butterfly counted on 2 rides, duplicate in one entry counted once');
ok(r[1].textContent.indexOf('5–4–3–2–1 senses') !== -1, '5-4-3-2-1 second at 2 rides');
ok(r[2].textContent.indexOf('Kind, factual words') !== -1, 'Kind words third');
ok(r[2].textContent.indexOf('1 ride') !== -1, 'singular "1 ride" copy');
ok(r.every(function (x) { return x.querySelector('.tt-go').textContent === 'Start'; }), 'every row has a Start action');
ok(t.d.getElementById('home-top-tools').textContent.indexOf('No scores, no streaks') !== -1, 'honest no-scores note present');
ok(!/premium|paywall|First Class|stripe/i.test(t.d.getElementById('home-top-tools').textContent), 'no monetization copy in card');

console.log('Start opens the tool, home return works:');
r[0].click();
ok(active(t.d) === 'screen-butterfly', 'Butterfly row opens the butterfly tool (got ' + active(t.d) + ')');
t.d.getElementById('btn-fly-done').click();
ok(active(t.d) === 'screen-home', 'tool done returns home');
ok(t.d.getElementById('home-top-tools').hidden === false, 'card still shown after returning home');

console.log('corrupt journal + sacred-flow isolation:');
t = boot('{not json');
ok(t.d.getElementById('home-top-tools').hidden === true, 'card hidden on corrupt journal (no crash)');
t.d.querySelector('button[data-go="screen-panic"]').click();
ok(active(t.d) === 'screen-panic', 'panic screen reachable');
ok(t.d.getElementById('screen-panic').innerHTML.indexOf('home-top-tools') === -1, 'panic screen carries no top-tools markup');

console.log('version markers:');
ok(/iht-v30/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js cache is iht-v30');
ok(/version 30/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')), 'About reads "version 30"');
ok(/\.toptool/.test(fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8')), 'toptool styles present');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
