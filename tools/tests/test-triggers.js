/* jsdom test for v49 "Patterns, not scores" trigger tags.
   Boots the real index.html + app.js (stubbed audio/geo/network) and exercises:
   reflection chips (5 tags, "nothing" exclusive, save to journal); the
   calm-time insight card in the toolkit (thresholds: >=3 tagged hard rides
   in the last 5, top trigger on >=2; ties toward the most recent; unknown
   ids never counted; corrupt journal hides the card); history + therapist
   summary trigger lines; backup-plan door from the insight card; panic
   screen carries no trigger markup; version markers; no voice, no paywall.
   Usage: node tools/tests/test-triggers.js  (run from tools/tests) */
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
function goToolkit(d) { d.querySelector('button[data-go="screen-toolkit"]').click(); }
function chip(d, id) { return d.querySelector('#reflect-triggers [data-trigger="' + id + '"]'); }
function insightLine(d) { return d.getElementById('home-trigger-insights-line').textContent; }

console.log('empty journal:');
let t = boot(undefined);
/* boot lands on the v33 splash by design (known harness staleness in
   test-toptools); the card assertions below do not depend on it. */
ok(t.d.getElementById('home-trigger-insights').hidden === true, 'insight card hidden with no journal');
const chips = Array.prototype.slice.call(t.d.querySelectorAll('#reflect-triggers .chip'));
ok(chips.length === 5, 'five trigger chips built (got ' + chips.length + ')');
ok(chips.map(function (c) { return c.textContent; }).join('|') === 'Crowded car|Delayed|Stopped in tunnel|Missed my stop|Nothing in particular', 'chip labels match the backlog set');
goToolkit(t.d);
ok(active(t.d) === 'screen-toolkit', 'toolkit reachable from home');
ok(t.d.getElementById('home-trigger-insights').hidden === true, 'insight card stays hidden after toolkit entry with no journal');

console.log('reflection chips + save:');
t = boot(undefined);
t.d.getElementById('btn-im-home').click();
ok(active(t.d) === 'screen-reflect', 'reflection screen reachable');
chip(t.d, 'delayed').click();
chip(t.d, 'tunnel').click();
ok(chip(t.d, 'delayed').getAttribute('aria-pressed') === 'true', 'Delayed pressed');
ok(chip(t.d, 'tunnel').getAttribute('aria-pressed') === 'true', 'Stopped in tunnel pressed');
chip(t.d, 'nothing').click();
ok(chip(t.d, 'delayed').getAttribute('aria-pressed') === 'false', '"Nothing in particular" clears Delayed');
ok(chip(t.d, 'tunnel').getAttribute('aria-pressed') === 'false', '"Nothing in particular" clears Stopped in tunnel');
ok(chip(t.d, 'nothing').getAttribute('aria-pressed') === 'true', '"Nothing in particular" pressed');
chip(t.d, 'delayed').click();
ok(chip(t.d, 'nothing').getAttribute('aria-pressed') === 'false', 'picking a real tag clears "Nothing in particular"');
ok(chip(t.d, 'delayed').getAttribute('aria-pressed') === 'true', 'Delayed pressed again after clearing nothing');
t.d.querySelector('#screen-reflect .feelbtn[data-r="harder"]').click();
t.d.getElementById('btn-reflect-done').click();
ok(active(t.d) === 'screen-home', 'Done returns home');
const saved = JSON.parse(t.w.localStorage.getItem('iht_journal'));
ok(saved.length === 1 && saved[0].after === 'harder', 'journal entry saved with after=harder');
ok(JSON.stringify(saved[0].triggers) === JSON.stringify(['delayed']), 'only the real tag stored (got ' + JSON.stringify(saved[0].triggers) + ')');

console.log('reflection with "nothing" stores no triggers:');
t = boot(undefined);
t.d.getElementById('btn-im-home').click();
chip(t.d, 'crowded').click();
chip(t.d, 'nothing').click();
t.d.getElementById('btn-reflect-done').click();
const saved2 = JSON.parse(t.w.localStorage.getItem('iht_journal'));
ok(JSON.stringify(saved2[0].triggers) === JSON.stringify([]), '"nothing" stores an empty trigger list (got ' + JSON.stringify(saved2[0].triggers) + ')');

console.log('insight card: pattern shown:');
const seeded = JSON.stringify([
  { t: '2026-10-01T10:00:00Z', after: 'harder', triggers: ['crowded'] },
  { t: '2026-10-05T10:00:00Z', after: 'harder', triggers: [] },
  { t: '2026-10-10T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-15T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-20T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-21T10:00:00Z', after: 'calmer', triggers: ['delayed'] },
]);
t = boot(seeded);
goToolkit(t.d);
ok(t.d.getElementById('home-trigger-insights').hidden === false, 'card shown when the pattern holds');
ok(insightLine(t.d) === '3 of your last 5 hard rides had delays. Your backup plan is ready for those.', 'exact insight line (got "' + insightLine(t.d) + '")');
ok(t.d.getElementById('home-trigger-insights').textContent.indexOf('Patterns, not scores') !== -1, 'honest no-scores note present');
ok(!/premium|paywall|First Class|stripe/i.test(t.d.getElementById('home-trigger-insights').textContent), 'no monetization copy in card');
t.d.querySelector('#home-trigger-insights [data-go="screen-plan"]').click();
ok(active(t.d) === 'screen-plan', 'backup-plan door opens My ride plan (got ' + active(t.d) + ')');

console.log('insight card: thresholds hide it:');
t = boot(JSON.stringify([
  { t: '2026-10-01T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-05T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-10T10:00:00Z', after: 'harder', triggers: [] },
  { t: '2026-10-15T10:00:00Z', after: 'harder' },
  { t: '2026-10-20T10:00:00Z', after: 'harder', triggers: [] },
]));
goToolkit(t.d);
ok(t.d.getElementById('home-trigger-insights').hidden === true, 'hidden when only 2 of 5 hard rides recorded a trigger');
t = boot(JSON.stringify([
  { t: '2026-10-01T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-05T10:00:00Z', after: 'harder', triggers: ['crowded'] },
  { t: '2026-10-10T10:00:00Z', after: 'harder', triggers: ['tunnel'] },
  { t: '2026-10-15T10:00:00Z', after: 'harder', triggers: [] },
  { t: '2026-10-20T10:00:00Z', after: 'harder', triggers: [] },
]));
goToolkit(t.d);
ok(t.d.getElementById('home-trigger-insights').hidden === true, 'hidden when the top trigger appears only once (not a pattern)');
t = boot(JSON.stringify([
  { t: '2026-10-01T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-05T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-10T10:00:00Z', after: 'harder', triggers: ['crowded'] },
]));
goToolkit(t.d);
ok(t.d.getElementById('home-trigger-insights').hidden === false, 'shown with only 3 hard rides when all 3 recorded a trigger');
ok(insightLine(t.d) === '2 of your last 3 hard rides had delays. Your backup plan is ready for those.', 'denominator follows the rides that exist (got "' + insightLine(t.d) + '")');

console.log('insight card: ties break toward the most recent, unknown ids ignored:');
t = boot(JSON.stringify([
  { t: '2026-10-01T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-05T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-10T10:00:00Z', after: 'harder', triggers: ['crowded'] },
  { t: '2026-10-15T10:00:00Z', after: 'harder', triggers: ['crowded'] },
  { t: '2026-10-20T10:00:00Z', after: 'harder', triggers: [] },
]));
goToolkit(t.d);
ok(insightLine(t.d) === '2 of your last 5 hard rides had a crowded car. Your backup plan is ready for those.', 'tie broken toward most recent (got "' + insightLine(t.d) + '")');
t = boot(JSON.stringify([
  { t: '2026-10-01T10:00:00Z', after: 'harder', triggers: ['bogus'] },
  { t: '2026-10-05T10:00:00Z', after: 'harder', triggers: ['bogus'] },
  { t: '2026-10-10T10:00:00Z', after: 'harder', triggers: ['bogus'] },
  { t: '2026-10-15T10:00:00Z', after: 'harder', triggers: ['delayed'] },
  { t: '2026-10-20T10:00:00Z', after: 'harder', triggers: ['delayed'] },
]));
goToolkit(t.d);
ok(t.d.getElementById('home-trigger-insights').hidden === false, 'shown despite unknown ids in the journal');
ok(insightLine(t.d) === '2 of your last 5 hard rides had delays. Your backup plan is ready for those.', 'unknown ids never counted (got "' + insightLine(t.d) + '")');
t = boot(JSON.stringify([
  { t: '2026-10-01T10:00:00Z', after: 'harder', triggers: ['bogus'] },
  { t: '2026-10-05T10:00:00Z', after: 'harder', triggers: ['bogus'] },
  { t: '2026-10-10T10:00:00Z', after: 'harder', triggers: ['bogus'] },
  { t: '2026-10-15T10:00:00Z', after: 'harder', triggers: [] },
  { t: '2026-10-20T10:00:00Z', after: 'harder', triggers: [] },
]));
goToolkit(t.d);
ok(t.d.getElementById('home-trigger-insights').hidden === true, 'hidden when only unknown ids were recorded');

console.log('corrupt journal + sacred-flow isolation:');
t = boot('{not json');
goToolkit(t.d);
ok(t.d.getElementById('home-trigger-insights').hidden === true, 'card hidden on corrupt journal (no crash)');
t.d.querySelector('button[data-go="screen-panic"]').click();
ok(active(t.d) === 'screen-panic', 'panic screen reachable');
ok(t.d.getElementById('screen-panic').innerHTML.indexOf('home-trigger-insights') === -1, 'panic screen carries no trigger-insight markup');
ok(t.d.getElementById('screen-panic').innerHTML.indexOf('reflect-triggers') === -1, 'panic screen carries no trigger-chip markup');

console.log('history + therapist summary carry the triggers:');
t = boot(JSON.stringify([
  { t: '2026-10-01T10:00:00Z', after: 'harder', triggers: ['delayed', 'crowded'], tools: ['5–4–3–2–1 senses'] },
  { t: '2026-10-05T10:00:00Z', after: 'calmer', triggers: ['delayed'], tools: ['5–4–3–2–1 senses'] },
  { t: '2026-10-10T10:00:00Z', after: 'same', triggers: ['delayed'], tools: [] },
  { t: '2026-10-12T10:00:00Z', after: 'harder', triggers: ['bogus'] },
]));
t.d.querySelector('button[data-go="screen-history"]').click();
ok(active(t.d) === 'screen-history', 'history reachable');
const histText = t.d.getElementById('history-list').textContent;
ok(histText.indexOf('What was happening: Delayed, Crowded car') !== -1, 'history shows the trigger line for a tagged ride');
ok(histText.indexOf('bogus') === -1, 'history never renders an unknown trigger id');
t.d.getElementById('btn-export-summary').click();
ok(active(t.d) === 'screen-summary', 'summary reachable from history');
const sumText = t.d.getElementById('summary-body').textContent;
ok(sumText.indexOf('What was happening: Delayed (3 rides), Crowded car (1 ride)') !== -1, 'summary shows per-month trigger counts (got "' + sumText.slice(0, 400) + '")');
t.d.getElementById('btn-summary-share').click();
const shared = t.d.getElementById('summary-hint').textContent;
ok(shared.indexOf('What was happening: Delayed (3 rides), Crowded car (1 ride)') !== -1, 'shared plain-text summary carries the trigger line');

console.log('version markers + no voice:');
ok(/iht-v49/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js cache is iht-v49');
ok(/version 49/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')), 'About reads "version 49"');
ok(!/speechSynthesis/.test(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')), 'no voice code added (speechSynthesis absent)');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
