/* jsdom test for v57 "Your sequence leads": when a rescue sequence is saved,
   the panic screen promotes it to the hero slot with the first tool named, and
   the scripted guide falls to a plain secondary card. When nothing is saved the
   screen is exactly the v56 screen: guide hero, sequence hidden. Boots the real
   index.html + app.js (stubbed audio/geo/network), saves/clears via the Privacy
   picker and via localStorage, and proves the hero still launches the sequence.
   Usage: node tools/tests/test-seq-hero.js (run from repo root or tools/tests). */
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

console.log('markup: sequence button carries its hero card structure:');
const panicSection = html.slice(html.indexOf('id="screen-panic"'), html.indexOf('id="screen-breathe"'));
ok(panicSection.includes('id="btn-panic-seq"'), 'panic screen has btn-panic-seq');
ok(/id="btn-panic-seq"[^>]*hidden/.test(panicSection), 'sequence button hidden by default in markup');
ok(panicSection.includes('id="seq-hero-first"'), 'first-tool line (seq-hero-first) exists');
ok(panicSection.includes('Start my sequence'), 'sequence button copy present');
ok(panicSection.indexOf('id="btn-panic-seq"') > panicSection.indexOf('id="btn-panic-worse"'), 'sequence button sits below the worse door in markup');
ok(panicSection.indexOf('id="btn-panic-seq"') < panicSection.indexOf('id="crisis-quiet"'), 'sequence button sits above the 988 quiet line in markup');
ok(panicSection.indexOf('id="btn-panic-guide"') < panicSection.indexOf('id="btn-panic-breathe"'), 'markup order unchanged: guide before breathe');
ok(panicSection.indexOf('id="btn-panic-breathe"') < panicSection.indexOf('id="btn-panic-ground"'), 'markup order unchanged: breathe before ground');

console.log('app.js + styles: the hero swap:');
ok(appJs.includes('function syncSeqButton'), 'syncSeqButton present');
ok(appJs.includes("b.classList.add('panicopt', 'po-seq', 'po-hero')"), 'saved sequence gains panicopt + po-seq + po-hero');
ok(appJs.includes("g.classList.remove('po-hero')"), 'guide loses po-hero when a sequence leads');
ok(appJs.includes("g.classList.add('po-hero')"), 'guide regains po-hero when nothing is saved');
ok(appJs.includes("seqTitle(ids[0]) + ' first'"), 'hero names the first tool');
ok(appJs.includes('insertBefore(b, g)'), 'sequence card moves ahead of the guide');
ok(css.includes('.po-seq'), 'po-seq style exists');
ok(/\.po-seq\s*\{[^}]*border-color:\s*rgba\(232,184,111/.test(css), 'po-seq uses the warm amber border');
ok(css.includes('#btn-panic-seq.linklike .po-ic'), 'linklike-state guard hides the card icon until promotion');

console.log('version markers:');
ok(html.includes('version 57'), 'About reads version 57');
ok(/var CACHE = 'iht-v57'/.test(sw), 'sw.js cache is iht-v57');

/* Live boot check: hero follows the saved sequence, guide stays launchable. */
function build(url, onboarded, seedSeq) {
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
  if (seedSeq) { w.localStorage.setItem('iht_rescue_seq', seedSeq); }
  ['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js'].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  return { w: w, d: w.document };
}
function active(d) { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
function click(d, sel) { const el = d.querySelector(sel); if (!el) { throw new Error('missing ' + sel); } el.click(); return el; }
function panicCards(d) { return Array.prototype.slice.call(d.querySelectorAll('#screen-panic .panicopt')); }

(async function live() {
  const PROD = 'https://i-hate-trains-aaryan0909s-projects.vercel.app/';

  console.log('live: nothing saved — the v56 screen, unchanged:');
  let t = build(PROD + '#panic', true, null);
  ok(active(t.d) === 'screen-panic', 'boots on screen-panic');
  let seq = t.d.getElementById('btn-panic-seq');
  let guide = t.d.getElementById('btn-panic-guide');
  ok(seq.hidden === true, 'sequence button hidden with nothing saved');
  ok(seq.classList.contains('linklike'), 'sequence button stays a quiet link when hidden');
  ok(guide.classList.contains('po-hero'), 'guide keeps the hero slot with nothing saved');
  let cards = panicCards(t.d);
  ok(cards.length === 3, 'panic screen carries 3 option cards (got ' + cards.length + ')');
  ok(cards[0].id === 'btn-panic-guide', 'guide is the FIRST card in DOM order');
  ok(cards[1].id === 'btn-panic-breathe', 'second card is Breathe');
  ok(cards[2].id === 'btn-panic-ground', 'third card is Ground');
  ok(t.d.getElementById('seq-hero-first').textContent === '', 'first-tool line empty with nothing saved');
  guide.click();
  ok(active(t.d) === 'screen-guide', 'tapping the guide hero still opens the guided rescue');

  console.log('live: sequence saved — your sequence leads:');
  t = build(PROD + '#panic', true, '["five-senses","breathe"]');
  ok(active(t.d) === 'screen-panic', 'boots on screen-panic with a saved sequence');
  seq = t.d.getElementById('btn-panic-seq');
  guide = t.d.getElementById('btn-panic-guide');
  ok(seq.hidden === false, 'sequence button visible once saved');
  ok(seq.classList.contains('panicopt'), 'sequence button is a card when saved');
  ok(seq.classList.contains('po-seq'), 'sequence card carries the po-seq accent');
  ok(seq.classList.contains('po-hero'), 'sequence card takes the hero slot');
  ok(!guide.classList.contains('po-hero'), 'guide falls out of the hero slot');
  ok(guide.classList.contains('panicopt'), 'guide stays a plain secondary card');
  ok(t.d.getElementById('seq-hero-first').textContent === '5–4–3–2–1 senses first', 'hero names the first tool ("5–4–3–2–1 senses first")');
  cards = panicCards(t.d);
  ok(cards.length === 4, 'panic screen carries 4 option cards with a sequence (got ' + cards.length + ')');
  ok(cards[0].id === 'btn-panic-seq', 'sequence card is FIRST in DOM order (above the fold)');
  ok(cards[1].id === 'btn-panic-guide', 'guide is second');
  ok(cards[2].id === 'btn-panic-breathe', 'third card is Breathe');
  ok(cards[3].id === 'btn-panic-ground', 'fourth card is Ground');
  ok(seq.querySelector('strong').textContent === 'Start my sequence', 'hero title unchanged');
  seq.click();
  ok(active(t.d) === 'screen-senses', 'tapping the hero starts the first saved tool (senses)');
  ok(t.d.getElementById('seq-label').textContent === 'Step 1 of 2 · 5–4–3–2–1 senses', 'bar reads step 1 of 2');

  console.log('live: clearing the sequence restores the guide hero:');
  t.d.getElementById('sos-float').click();
  ok(active(t.d) === 'screen-panic', 'SOS float returns to the panic screen');
  t.w.localStorage.setItem('iht_rescue_seq', '[]');
  click(t.d, '#screen-panic [data-go="screen-home"]');
  ok(active(t.d) === 'screen-home', 'back link reaches home');
  click(t.d, '#screen-home [data-go="screen-panic"]');
  ok(active(t.d) === 'screen-panic', 'back on the panic screen');
  seq = t.d.getElementById('btn-panic-seq');
  guide = t.d.getElementById('btn-panic-guide');
  ok(seq.hidden === true, 'sequence button hidden again after clearing');
  ok(guide.classList.contains('po-hero'), 'guide regains the hero slot');
  cards = panicCards(t.d);
  ok(cards.length === 3, 'panic screen back to 3 option cards');
  ok(cards[0].id === 'btn-panic-guide', 'guide first again');
  const worse = t.d.getElementById('btn-panic-worse');
  const q988 = t.d.getElementById('crisis-quiet');
  ok(worse.compareDocumentPosition(seq) & 4, 'sequence button sits below the worse door again');
  ok(seq.compareDocumentPosition(q988) & 4, 'sequence button sits above the 988 line again');
  ok(t.d.getElementById('seq-hero-first').textContent === '', 'first-tool line cleared');

  console.log('live: corrupt / unknown saved lists still degrade safely:');
  t.w.localStorage.setItem('iht_rescue_seq', '{bad json');
  click(t.d, '#screen-panic [data-go="screen-home"]');
  click(t.d, '#screen-home [data-go="screen-panic"]');
  ok(t.d.getElementById('btn-panic-seq').hidden === true, 'corrupt sequence hides the button, guide stays hero');
  ok(t.d.getElementById('btn-panic-guide').classList.contains('po-hero'), 'guide hero after corrupt key');
  t.w.localStorage.setItem('iht_rescue_seq', '["nope","breathe"]');
  click(t.d, '#screen-panic [data-go="screen-home"]');
  click(t.d, '#screen-home [data-go="screen-panic"]');
  ok(t.d.getElementById('btn-panic-seq').hidden === false, 'unknown ids dropped, valid one still promotes the hero');
  ok(t.d.getElementById('seq-hero-first').textContent === 'Breathe with me first', 'first tool is the valid one');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('  FAIL harness error: ' + (e && e.stack || e)); process.exit(1); });
