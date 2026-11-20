/* jsdom test for v56 "Every stop is an exit".
   Boots the real index.html + app.js (stubbed audio/geo/network) and exercises:
   the trip-screen outs list on a real station trip (names in line order,
   Next-stop / Your-stop tags, the exit line on every row, re-render on
   tap and undo, down to one stop left); the count-only fallback (one honest
   line, no invented names); the setup note framing in both modes; the
   collapsed-by-default state (panic flow untouched); version markers;
   no voice, no paywall.
   The station trip drives the real city/line/stop selects: Toronto Line 1,
   Finch -> Eglinton (5 stops), served by the ttc.json fallback in the
   fetch stub (stations/toronto.json is offline here, as in a tunnel).
   Usage: node tools/tests/test-exits.js  (run from the project root) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function waitFor(fn, label) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (fn()) { return true; }
    await sleep(25);
  }
  ok(false, 'timed out waiting for: ' + label);
  return false;
}

function param() {
  return {
    value: 0,
    setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, cancelScheduledValues() {}
  };
}
function nodeStub() { return { connect() {}, disconnect() {} }; }

function boot(opts) {
  opts = opts || {};
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script src="(drift|trimap|crisis|metros|stations|app|stopheads|guide|sound|calm42|ready|platform)\.js"><\/script>/g, '<!-- inlined by test -->');
  const dom = new JSDOM(html, {
    url: 'https://i-hate-trains-aaryan0909s-projects.vercel.app/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.AudioContext = function () {
        return {
          sampleRate: 44100,
          currentTime: 0,
          destination: {},
          state: 'running',
          resume() {},
          createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0 }, detune: { value: 0 }, type: '' }; },
          createGain() { return { connect() {}, gain: param() }; },
          createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null, loop: false }; },
          createBiquadFilter() { return { connect() {}, frequency: { value: 0 }, Q: { value: 0 }, type: '' }; },
          createDynamicsCompressor() { return { connect() {}, threshold: { value: 0 }, ratio: { value: 0 } }; },
          createBuffer(ch, len) { return { getChannelData() { return new Float32Array(len); } }; }
        };
      };
      Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
      window.navigator.geolocation = {
        watchPosition() { return 1; }, clearWatch() {},
        getCurrentPosition(s) { s({ coords: { latitude: 43.65, longitude: -79.38 } }); }
      };
      window.matchMedia = window.matchMedia || ((q) => ({
        matches: !!opts.reducedMotion && String(q).indexOf('prefers-reduced-motion') !== -1,
        addListener() {}, removeListener() {}
      }));
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
  ['drift.js', 'trimap.js', 'crisis.js', 'metros.js', 'stations.js', 'sound.js', 'app.js', 'stopheads.js', 'guide.js', 'calm42.js', 'ready.js', 'platform.js'].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  return { w: w, d: w.document };
}
function activeId(d) { const a = d.querySelector('.screen.active'); return a ? a.id : null; }
function click(el) { el.click(); }
function change(w, el, value) {
  el.value = value;
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
}
function goSetup(env) {
  const d = env.d;
  click(d.getElementById('btn-start-ride'));
  click(d.querySelector('#screen-checkin .feelbtn[data-feel="steady"]'));
  click(d.getElementById('btn-checkin-continue'));
  click(d.querySelector('#screen-checklist [data-go="screen-setup"]'));
  ok(activeId(d) === 'screen-setup', 'checklist -> ride setup');
}
function outsRows(d) {
  return Array.prototype.slice.call(d.querySelectorAll('#outs-list li')).map(function (li) {
    var nameEl = li.querySelector('.outs-name');
    return {
      // the tag span lives inside the name div; the station name is its first text node
      name: nameEl && nameEl.firstChild ? nameEl.firstChild.textContent : '',
      tag: (li.querySelector('.outs-tag') || {}).textContent || '',
      line: (li.querySelector('.outs-line') || {}).textContent || ''
    };
  });
}
const EXIT_LINE = 'Step off here, sit, breathe, re-board when ready.';

(async function main() {
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

  /* ---------- A. static: markup, styles, wiring, version ---------- */
  console.log('static: outs section exists and is wired:');
  const tripSection = html.slice(html.indexOf('id="screen-trip"'), html.indexOf('id="screen-trimap"'));
  ok(tripSection.indexOf('id="outs-details"') !== -1, 'trip screen has the outs details section');
  ok(tripSection.indexOf('Your outs on this ride') !== -1, 'outs summary copy present');
  ok(tripSection.indexOf('id="outs-list"') !== -1, 'outs list element present');
  ok(tripSection.indexOf('You can step off at any stop. The doors open at every one.') !== -1, 'count-only fallback line present');
  ok(tripSection.indexOf('id="outs-details"') > tripSection.indexOf('id="btn-show-map"'), 'outs sits below the map button, not above the tap button');
  const panicStart = html.indexOf('id="screen-panic"');
  const panicSection = html.slice(panicStart, html.indexOf('</section>', panicStart));
  ok(panicSection.indexOf('outs-details') === -1, 'panic screen carries no outs section');
  ok(css.indexOf('.outs-list') !== -1 && css.indexOf('.outs-tag') !== -1, 'outs styles exist');
  ok(/function renderOuts\(\)/.test(appJs), 'renderOuts exists');
  ok(/renderStops\(\) \{[^}]*renderOuts\(\)/.test(appJs) || appJs.indexOf('renderTripStation();\n    renderOuts();') !== -1, 'renderStops calls renderOuts on every counter change');
  ok(appJs.indexOf('Every stop on the way is an exit') !== -1, 'setup note carries the exit framing');
  ok(appJs.indexOf('speechSynthesis') === -1, 'no voice anywhere (v35 removal holds)');
  ok(sw.indexOf('iht-v56') !== -1, 'sw.js carries iht-v56');
  ok(html.indexOf('version 56') !== -1, 'About reads version 56');
  ok(html.indexOf('iht-v55') === -1 && sw.indexOf('iht-v55') === -1, 'no stale v55 markers');

  /* ---------- B. count-only trip: fallback, no invented names ---------- */
  console.log('live: count-only trip gets the honest line, not invented stops:');
  let env = boot();
  let d = env.d, w = env.w;
  goSetup(env);
  ok(d.getElementById('setup-stops-note').textContent.indexOf('exit') === -1, 'no-city setup note makes no exit claim before a route exists');
  click(d.getElementById('btn-start-trip'));
  ok(activeId(d) === 'screen-trip', 'start trip reaches the trip screen');
  ok(d.getElementById('stops-left').textContent === '5', 'trip starts with 5 stops to go');
  ok(outsRows(d).length === 0, 'count-only trip lists no station names');
  ok(d.getElementById('outs-fallback').hidden === false, 'count-only fallback line is shown');
  ok(d.getElementById('outs-count').textContent === 'Every stop is an exit', 'count-only summary reads "Every stop is an exit"');
  ok(d.getElementById('outs-details').open === false, 'outs section is collapsed by default');

  /* ---------- C. station trip: Finch -> Eglinton on Line 1 ---------- */
  console.log('live: station trip lists the outs in line order:');
  env = boot();
  d = env.d; w = env.w;
  goSetup(env);
  change(w, d.getElementById('sel-city'), 'toronto');
  await waitFor(function () { return d.getElementById('sel-line').options.length > 1; }, 'line options after city pick');
  change(w, d.getElementById('sel-line'), '1');
  await waitFor(function () { return d.getElementById('sel-from').options.length > 1; }, 'station options after line pick');
  ok(d.getElementById('sel-from').options.length > 30, 'Line 1 station list loaded (38 stops)');
  change(w, d.getElementById('sel-from'), '0'); // Finch
  change(w, d.getElementById('sel-dest'), '5'); // Eglinton
  ok(d.getElementById('stops-count').textContent === '5', 'route counts 5 stops, Finch to Eglinton');
  ok(d.getElementById('setup-stops-note').textContent.indexOf('Every stop on the way is an exit') !== -1, 'setup note frames the stops as exits');
  click(d.getElementById('btn-start-trip'));
  ok(activeId(d) === 'screen-trip', 'station trip reaches the trip screen');
  ok(d.getElementById('outs-fallback').hidden === true, 'fallback hidden when station names exist');
  ok(d.getElementById('outs-count').textContent === '5 exits ahead', 'summary counts 5 exits ahead');
  let rows = outsRows(d);
  ok(rows.length === 5, 'five remaining stops listed as outs');
  ok(rows.map(function (r) { return r.name; }).join(' | ') === 'North York Centre | Sheppard-Yonge | York Mills | Lawrence | Eglinton', 'outs are in line order');
  ok(rows[0].name === 'North York Centre' && rows[0].tag === 'Next stop', 'first out is the next stop, tagged');
  ok(rows[0].line === EXIT_LINE, 'next-stop row carries the exit line');
  ok(rows[2].name === 'York Mills' && rows[2].tag === '' && rows[2].line === EXIT_LINE, 'middle out has no tag and the exit line');
  ok(rows[4].name === 'Eglinton' && rows[4].tag === 'Your stop', 'last out is the destination, tagged Your stop');
  ok(rows[4].line === 'Your stop \u2014 step off and you\u2019re there.', 'destination row reads as arrival, not an exit');
  ok(d.getElementById('outs-details').open === false, 'outs still collapsed by default on a station trip');

  /* ---------- D. advance + undo re-render the list ---------- */
  console.log('live: tap and undo re-render the outs:');
  click(d.getElementById('btn-stop-tap'));
  ok(d.getElementById('stops-left').textContent === '4', 'one tap: 5 stops -> 4');
  rows = outsRows(d);
  ok(rows.length === 4 && rows[0].name === 'Sheppard-Yonge' && rows[0].tag === 'Next stop', 'passed stop drops off; the next stop becomes the first out');
  ok(d.getElementById('outs-count').textContent === '4 exits ahead', 'summary counts 4 exits ahead');
  click(d.getElementById('btn-stop-undo'));
  ok(d.getElementById('stops-left').textContent === '5', 'undo: 4 stops -> 5');
  rows = outsRows(d);
  ok(rows.length === 5 && rows[0].name === 'North York Centre', 'undo gives the passed stop back as an out');
  for (let i = 0; i < 4; i++) {
    await sleep(800); // past the 700ms tap-debounce window
    click(d.getElementById('btn-stop-tap'));
  }
  ok(d.getElementById('stops-left').textContent === '1', 'four taps leave 1 stop to go');
  rows = outsRows(d);
  ok(rows.length === 1 && rows[0].name === 'Eglinton' && rows[0].tag === 'Your stop', 'one stop left: only the destination remains, tagged Your stop');
  ok(d.getElementById('outs-count').textContent === '1 exit ahead', 'summary counts 1 exit ahead');

  console.log(fail === 0 ? ('\nPASS ' + pass + '/' + pass) : ('\nFAIL ' + fail + ' of ' + (pass + fail)));
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error(e); process.exit(1); });
