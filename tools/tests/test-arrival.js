/* jsdom test for v58 "I'm off the train" arrival text.
   Boots the real index.html + app.js (stubbed audio/geo/network) and exercises:
   reflection screen carries the arrival card (button + hidden hint); share
   sends "Off the train — made it to <dest>. All good." with a destination and
   plain "Off the train, all good." without one; clipboard fallback copies the
   text; no-share/no-clipboard shows the text itself; the hint appears after
   each path; Done still saves the journal and returns home; the panic screen
   carries no arrival markup; version markers; no voice, no paywall.
   Usage: node tools/tests/test-arrival.js  (run from tools/tests) */
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
  ['drift.js', 'trimap.js', 'crisis.js', 'app.js', 'stopheads.js', 'guide.js'].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  return { w: w, d: w.document };
}
function active(d) { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
function reflect(t) { t.d.getElementById('btn-im-home').click(); return active(t.d) === 'screen-reflect'; }

console.log('markup + version markers:');
let t = boot({ share: true });
ok(reflect(t), 'reflection screen reachable');
const btn = t.d.getElementById('btn-arrival-text');
ok(btn && btn.textContent.indexOf('off the train') !== -1, 'arrival button present on reflection screen');
ok(t.d.getElementById('arrival-hint').hidden === true, 'arrival hint hidden until used');
const panicHtml = t.d.getElementById('screen-panic').innerHTML;
ok(panicHtml.indexOf('btn-arrival-text') === -1 && panicHtml.indexOf('arrival') === -1, 'panic screen carries no arrival markup');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
ok(sw.indexOf('iht-v58') !== -1, 'sw.js cache is iht-v58');
ok(t.d.getElementById('app-version').textContent.indexOf('58') !== -1, 'About reads version 58');
ok(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').indexOf('speechSynthesis') === -1, 'no voice anywhere (speechSynthesis absent)');

console.log('share path, with destination:');
t = boot({ share: true });
ok(reflect(t), 'reflection screen reachable (share run)');
t.d.getElementById('in-dest').value = 'Eglinton';
t.d.getElementById('btn-arrival-text').click();
ok(t.w.__shared && t.w.__shared.text.indexOf('made it to Eglinton') !== -1, 'shared text names the destination (got ' + (t.w.__shared && t.w.__shared.text) + ')');
ok(t.w.__shared && t.w.__shared.text.indexOf('All good') !== -1, 'shared text says all good');
ok(t.w.__shared && t.w.__shared.title.indexOf('off the train') !== -1, 'share title is the arrival text');
ok(t.d.getElementById('arrival-hint').hidden === false, 'hint shown after share');
ok(t.d.getElementById('arrival-hint').textContent.indexOf('Sent') === 0, 'hint confirms the send');
ok(active(t.d) === 'screen-reflect', 'sharing never leaves the reflection screen');

console.log('share path, count-only trip (no destination):');
t = boot({ share: true });
ok(reflect(t), 'reflection screen reachable (no-dest run)');
t.d.getElementById('in-dest').value = '';
t.d.getElementById('btn-arrival-text').click();
ok(t.w.__shared && t.w.__shared.text === 'Off the train, all good. \u2014 via I Hate Trains', 'plain arrival text with no destination (got ' + (t.w.__shared && t.w.__shared.text) + ')');

console.log('clipboard fallback:');
t = boot({ clipboard: true });
ok(reflect(t), 'reflection screen reachable (clipboard run)');
t.d.getElementById('in-dest').value = 'Finch';
t.d.getElementById('btn-arrival-text').click();
ok(t.w.__shared === undefined, 'no share sheet attempted without navigator.share');
ok(t.w.__copied && t.w.__copied.indexOf('made it to Finch') !== -1, 'arrival text copied to clipboard (got ' + t.w.__copied + ')');

console.log('no-share, no-clipboard fallback:');
t = boot({});
ok(reflect(t), 'reflection screen reachable (plain-text run)');
t.d.getElementById('in-dest').value = 'Bloor-Yonge';
t.d.getElementById('btn-arrival-text').click();
const hintText = t.d.getElementById('arrival-hint').textContent;
ok(t.d.getElementById('arrival-hint').hidden === false, 'hint shown as the plain-text fallback');
ok(hintText.indexOf('made it to Bloor-Yonge') !== -1, 'hint itself carries the arrival text (got ' + hintText + ')');

console.log('reflection flow intact:');
t = boot({ share: true });
ok(reflect(t), 'reflection screen reachable (flow run)');
t.d.getElementById('in-dest').value = 'Eglinton';
t.d.getElementById('btn-arrival-text').click();
t.d.querySelector('#screen-reflect .feelbtn[data-r="calmer"]').click();
t.d.getElementById('btn-reflect-done').click();
ok(active(t.d) === 'screen-home', 'Done still returns home after sharing');
const saved = JSON.parse(t.w.localStorage.getItem('iht_journal'));
ok(saved.length === 1 && saved[0].after === 'calmer', 'journal entry still saved');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
