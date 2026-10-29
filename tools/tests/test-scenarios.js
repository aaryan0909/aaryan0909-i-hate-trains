/* Static test for v37 "Rehearse the worst 90 seconds" scenario prep.
   No app boot: checks the real index.html / styles.css / sw.js for the
   screen, its three scenario cards, calm-time-only entry, and version
   markers. Usage: node tools/tests/test-scenarios.js (run from repo root
   or tools/tests). */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

console.log('screen + entry:');
ok(html.includes('id="screen-scenarios"'), 'screen-scenarios section exists');
ok(html.includes('data-go="screen-scenarios"'), 'entry button links to screen-scenarios');
const learnSection = html.slice(html.indexOf('id="screen-learn"'), html.indexOf('id="screen-walk"'));
ok(learnSection.includes('data-go="screen-scenarios"'), 'entry lives on the Learn screen (calm-time only)');
ok(learnSection.includes('Rehearse the hard moments'), 'Learn entry card copy present');

console.log('three scenarios, full structure:');
const scenSection = html.slice(html.indexOf('id="screen-scenarios"'), html.indexOf('id="screen-walk"'));
const details = scenSection.match(/<details class="scen">/g) || [];
ok(details.length === 3, 'exactly 3 scenario cards (got ' + details.length + ')');
['Stopped between stations', 'Missed my stop', 'Crush-loaded car'].forEach(function (t) {
  ok(scenSection.includes(t), 'scenario present: ' + t);
});
['What actually happens next', 'Reach for', '30-second rehearsal'].forEach(function (h) {
  const n = (scenSection.match(new RegExp('class="scen-h">' + h, 'g')) || []).length;
  ok(n === 3, 'heading "' + h + '" on all 3 cards (got ' + n + ')');
});
ok(scenSection.includes('data-go="screen-breathe"'), 'breathe tool button present');
ok((scenSection.match(/data-go="screen-toolkit"/g) || []).length >= 2, 'toolkit buttons present');
ok(scenSection.includes('Coping tools, not treatment'), 'clinical-honesty line present');

console.log('sacred-flow isolation:');
const panicSection = html.slice(html.indexOf('id="screen-panic"'), html.indexOf('id="screen-breathe"'));
ok(!panicSection.includes('screen-scenarios'), 'panic screen never links to scenarios');
ok(!scenSection.includes('id="screen-panic"'), 'scenarios screen carries no panic-screen id');
ok(scenSection.includes('data-go="screen-learn"'), 'back link returns to Learn, not panic');

console.log('styles + version:');
ok(css.includes('.scen summary'), 'scenario summary CSS present');
ok(css.includes('.scen-body ol'), 'rehearsal list CSS present');
ok(css.includes('min-height: 64px'), 'summary tap target >= 64px');
ok(html.includes('version 39'), 'About reads version 39');
ok(/var CACHE = 'iht-v39'/.test(sw), 'sw.js cache is iht-v39');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
