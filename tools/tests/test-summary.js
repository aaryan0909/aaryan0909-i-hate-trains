/* jsdom test for v45 "Take my rides to my therapist" + trip-card nudge line.
   Boots the real index.html + app.js (stubbed audio/geo/network) and exercises:
   empty journal -> export button hidden; seeded journal -> summary screen builds
   per-month cards (rides, after-feelings, top tools with counts, own words),
   newest month first, notes capped at 4; Print calls window.print; Share uses
   navigator.share with the plain-text summary (clipboard fallback); corrupt
   journal hides the export button and never crashes; trip card mentions the
   stop nudge only when quiet/spoken alerts are on; panic screen untouched;
   version markers.
   Usage: node tools/tests/test-summary.js  (run from tools/tests) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

function boot(opts) {
  opts = opts || {};
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
      window.print = () => { window.__printed = true; };
      if (opts.share) {
        // synchronous thenable: the app's .then() runs in the same tick, so the
        // hint assertion below reads the post-share state without an async harness.
        window.navigator.share = (args) => { window.__shared = args; return { then: function (cb) { cb(); return { catch: function () {} }; }, catch: function () {} }; };
      }
      if (opts.clipboard) {
        window.navigator.clipboard = { writeText: (t) => { window.__copied = t; return Promise.resolve(); } };
      }
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
  if (opts.journal !== undefined) { w.localStorage.setItem('iht_journal', opts.journal); }
  if (opts.prefs !== undefined) { w.localStorage.setItem('iht_prefs', opts.prefs); }
  ['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js'].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  return { w: w, d: w.document };
}
function active(d) { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
function goHistory(d) { d.querySelector('button[data-go="screen-history"]').click(); }

const seeded = JSON.stringify([
  { t: '2026-10-20T10:00:00Z', before: 'uneasy', after: 'calmer', tools: ['5–4–3–2–1 senses', 'Butterfly taps'], note: 'Grounding got me through the tunnel.' },
  { t: '2026-10-21T10:00:00Z', before: 'steady', after: 'calmer', tools: ['5–4–3–2–1 senses'] },
  { t: '2026-10-22T10:00:00Z', before: 'spiraling', after: 'same', tools: ['Kind, factual words'], note: 'Still shaky but I stayed on.' },
  { t: '2026-10-23T10:00:00Z', before: 'uneasy', after: 'harder', tools: ['Not a real tool'] },
  { t: '2026-11-02T10:00:00Z', before: 'uneasy', after: 'calmer', tools: ['Butterfly taps', 'Butterfly taps'], note: 'November ride, felt ok.' },
  { t: '2026-11-03T10:00:00Z', before: 'steady', after: 'calmer', tools: [] },
]);

console.log('static markers:');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
ok(/id="btn-export-summary"/.test(html), 'index.html carries #btn-export-summary');
ok(/id="screen-summary"/.test(html), 'index.html carries #screen-summary');
ok(/id="btn-summary-print"/.test(html), 'index.html carries #btn-summary-print');
ok(/id="btn-summary-share"/.test(html), 'index.html carries #btn-summary-share');
ok(/id="summary-body"/.test(html), 'index.html carries #summary-body');
ok(/version 45/.test(html), 'About reads version 45');
ok(/iht-v45/.test(swSrc), 'sw.js cache bumped to iht-v45');
ok(/@media print/.test(cssSrc), 'styles.css has a print block');
ok(/\.sum-month/.test(cssSrc), 'styles.css has .sum-month');
ok(/#screen-summary/.test(cssSrc), 'print block targets the summary screen');
ok(/buildSummaryData/.test(appSrc), 'app.js has buildSummaryData');
ok(/renderSummary/.test(appSrc), 'app.js has renderSummary');
ok(/summaryText/.test(appSrc), 'app.js has summaryText');
ok(!/speechSynthesis/.test(appSrc.slice(appSrc.indexOf('ride summary for a therapist'))), 'no voice in the summary code');
ok(!/premium|paywall|First Class|stripe/i.test(html.slice(html.indexOf('screen-summary'), html.indexOf('screen-summary') + 2000)), 'no monetization copy in the summary screen');

console.log('empty journal:');
let t = boot({});
goHistory(t.d);
ok(t.d.getElementById('btn-export-summary').hidden === true, 'export button hidden with no journal');
ok(t.d.getElementById('export-hint').hidden === true, 'export hint hidden with no journal');

console.log('seeded journal -> summary:');
t = boot({ journal: seeded, share: true });
goHistory(t.d);
ok(t.d.getElementById('btn-export-summary').hidden === false, 'export button shown with journal data');
t.d.getElementById('btn-export-summary').click();
ok(active(t.d) === 'screen-summary', 'export opens the summary screen (got ' + active(t.d) + ')');
const body = t.d.getElementById('summary-body');
ok(body.textContent.indexOf('6 rides') !== -1, 'header counts 6 rides');
const months = Array.prototype.slice.call(body.querySelectorAll('.sum-month'));
ok(months.length === 2, 'two month cards (got ' + months.length + ')');
ok(months[0].textContent.indexOf('November 2026') !== -1, 'newest month first (November)');
ok(months[0].textContent.indexOf('2 rides') !== -1, 'November card counts 2 rides');
ok(months[1].textContent.indexOf('October 2026') !== -1, 'October second');
ok(months[1].textContent.indexOf('4 rides') !== -1, 'October card counts 4 rides');
ok(body.textContent.indexOf('calmer after: 2') !== -1, 'October after-feelings counted (calmer 2)');
ok(body.textContent.indexOf('harder after: 1') !== -1, 'October harder counted (1)');
ok(body.textContent.indexOf('5–4–3–2–1 senses (2 rides)') !== -1, 'top tool counted per ride (5-4-3-2-1, 2 rides)');
ok(body.textContent.indexOf('Not a real tool') === -1, 'unknown tool title never counted or shown');
ok(body.textContent.indexOf('Grounding got me through the tunnel.') !== -1, 'own words quoted');
ok(body.textContent.indexOf('Coping tools, not treatment') !== -1, 'honest footer present');
ok(body.textContent.indexOf('trigger') === -1, 'no invented trigger section');

console.log('print + share:');
t.w.__printed = false;
t.d.getElementById('btn-summary-print').click();
ok(t.w.__printed === true, 'Print calls window.print');
t.d.getElementById('btn-summary-share').click();
ok(!!t.w.__shared, 'Share uses navigator.share');
ok(t.w.__shared && t.w.__shared.text.indexOf('6 rides') !== -1, 'shared text carries the ride count');
ok(t.w.__shared && t.w.__shared.text.indexOf('November 2026') !== -1, 'shared text carries months');
ok(t.d.getElementById('summary-hint').textContent.indexOf('Summary sent') !== -1, 'hint confirms the send');

console.log('share fallback (clipboard, no navigator.share):');
t = boot({ journal: seeded, clipboard: true });
goHistory(t.d);
t.d.getElementById('btn-export-summary').click();
t.d.getElementById('btn-summary-share').click();
ok(typeof t.w.__copied === 'string' && t.w.__copied.indexOf('6 rides') !== -1, 'clipboard fallback copies the summary text');

console.log('corrupt journal + sacred-flow isolation:');
t = boot({ journal: '{not json' });
goHistory(t.d);
ok(t.d.getElementById('btn-export-summary').hidden === true, 'export hidden on corrupt journal (no crash)');
ok(active(t.d) === 'screen-history', 'still on history after corrupt journal');
t.d.querySelector('button[data-go="screen-panic"]').click();
ok(active(t.d) === 'screen-panic', 'panic screen still reachable');
ok(t.d.getElementById('screen-panic').textContent.indexOf('Export my summary') === -1, 'no summary surface on the panic screen');

console.log('trip card nudge line:');
t = boot({ prefs: JSON.stringify({ stopHeadsQuiet: true }) });
// no navigator.share / clipboard in this boot, so the handler falls back to
// putting the full card text in the hint — the nudge clause must be in it.
t.d.getElementById('in-city').value = 'Toronto';
t.d.getElementById('in-line').value = 'Line 1';
t.d.getElementById('in-dest').value = 'Bloor';
t.d.getElementById('btn-share-card').click();
ok(t.d.getElementById('share-hint').textContent.indexOf('nudge me when my stop is near') !== -1, 'trip card mentions the stop nudge when quiet alerts are on');
t = boot({ prefs: JSON.stringify({}) });
t.d.getElementById('btn-share-card').click();
ok(t.d.getElementById('share-hint').textContent.indexOf('nudge') === -1, 'no nudge claim when alerts are off');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
