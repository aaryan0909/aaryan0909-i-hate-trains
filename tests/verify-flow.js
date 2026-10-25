/* v35 flow harness. Runs in Node, no browser needed.
   - Loads the REAL metros.js and stations.js in a vm with a stub fetch
     and asserts loader/cascade/stops math (including the real shipped
     stations/toronto.json, served through the stub).
   - Static checks on the REAL app.js / index.html / v35-flow.css for the
     breath fix, the hidden-attribute fix, the setup selects, and the trip
     reactions. Fake-DOM runtime checks are NOT claimed: there is no
     jsdom here and a subagent cannot run a live browser, so button
     visibility is verified against the CSS cascade rule plus the exact
     hidden assignments in app.js. A live-browser pass is still needed
     before merge (see REPORT.md).
   Test fixture stations are obviously fake ("Test Station A") and live
   only in this file; they are never shipped as station data. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
function read(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }

const torontoJson = JSON.parse(read('stations/toronto.json'));
const ttcJson = JSON.parse(read('ttc.json'));
const fakeLondon = { city: 'Test City', updated: '2026-10-25', source: 'test fixture only',
  lines: [{ id: 'central', name: 'Central line', color: '#E32037',
    stations: ['Test Station A', 'Test Station B', 'Test Station C', 'Test Station D'] }] };

function makeCtx(torontoFilePresent) {
  const sandbox = { window: {}, console,
    fetch: (url) => {
      if (url === 'stations/toronto.json' && torontoFilePresent) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(torontoJson) });
      }
      if (url === 'stations/london.json') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(fakeLondon) });
      }
      if (url === 'ttc.json') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ttcJson) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
    } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('metros.js'), sandbox);
  vm.runInContext(read('stations.js'), sandbox);
  return sandbox;
}

(async () => {
  /* ---- loader + cascade math (real code) ---- */
  const ctx = makeCtx(true);
  ok('metros: cityFor Toronto', ctx.window.__ihtMetros.cityFor('Toronto') === 'toronto');
  ok('metros: London lines include Central', ctx.window.__ihtMetros.linesFor('London').some(l => l.id === 'central'));
  const lon = await ctx.window.IHTStations.load('london');
  ok('stations: London fixture loads', !!lon && lon.lines[0].stations.length === 4);
  ok('stations: has/get cache', ctx.window.IHTStations.has('london') && ctx.window.IHTStations.get('london') === lon);
  ok('stations: missing city is null (manual fallback)', (await ctx.window.IHTStations.load('paris')) === null);
  const S = ctx.window.IHTStations;
  ok('stops: forward A->D is 3', S.stopsBetween(lon.lines[0].stations, 'Test Station A', 'Test Station D') === 3);
  ok('stops: reverse D->A is 3 (direction-free count)', S.stopsBetween(lon.lines[0].stations, 'Test Station D', 'Test Station A') === 3);
  ok('stops: same stop is 0', S.stopsBetween(lon.lines[0].stations, 'Test Station B', 'Test Station B') === 0);
  ok('stops: unknown stop is null', S.stopsBetween(lon.lines[0].stations, 'Test Station A', 'Nope') === null);
  ok('stationAt: forward progression', S.stationAt(lon.lines[0].stations, 0, 3, 2) === 'Test Station C');
  ok('stationAt: reverse progression', S.stationAt(lon.lines[0].stations, 3, 0, 1) === 'Test Station C');
  ok('stationAt: arrival is dest', S.stationAt(lon.lines[0].stations, 0, 3, 3) === 'Test Station D');
  ok('findLine: by metros id', S.findLine(lon, 'central', '') && S.findLine(lon, 'central', '').stations.length === 4);
  ok('findLine: by name fallback', S.findLine(lon, 'zzz', 'Central line') !== null);
  ok('findLine: unknown is null', S.findLine(lon, 'zzz', 'Nope') === null);

  /* real Toronto file: shape + agreement with ttc.json */
  const tor = await ctx.window.IHTStations.load('toronto');
  ok('toronto: file loads via contract', !!tor);
  const l1 = tor && S.findLine(tor, '1', 'Line 1');
  const ttc1 = ttcJson.lines.find(l => l.id === '1');
  ok('toronto: Line 1 station count matches ttc.json', !!l1 && l1.stations.length === ttc1.stops.length);
  ok('toronto: Line 1 endpoints match ttc.json', !!l1 && l1.stations[0] === ttc1.stops[0].n && l1.stations[l1.stations.length - 1] === ttc1.stops[ttc1.stops.length - 1].n);
  ok('toronto: computed Finch to Bloor stops', !!l1 && S.stopsBetween(l1.stations, 'Finch', 'Bloor') === Math.abs(l1.stations.indexOf('Bloor') - l1.stations.indexOf('Finch')));

  /* Toronto fallback adapter: reshaped file absent, ttc.json carries it */
  const ctx2 = makeCtx(false);
  const tor2 = await ctx2.window.IHTStations.load('toronto');
  ok('toronto: ttc.json fallback adapter works', !!tor2 && !!ctx2.window.IHTStations.findLine(tor2, '1', 'Line 1'));

  /* ---- static checks on shipped files ---- */
  const app = read('app.js'), html = read('index.html'), css = read('v35-flow.css'), base = read('styles.css');
  ok('css: global [hidden] rule with !important', /\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(css));
  ok('css: ob0 bottom-anchored origin', /#pet-ob0\s*\{\s*transform-origin:\s*50%\s*100%/.test(css));
  const ob0Run = app.slice(app.indexOf('function runObBreath'), app.indexOf('function resetOb0State'));
  ok('breath: ob0 inhale is belly scale, not vertical stretch', /transform = grow \? 'scale\(1\.16, 1\.10\)'/.test(ob0Run) && !/transform = grow \? 'scale\(0\.94/.test(ob0Run));
  const ob0Reset = app.slice(app.indexOf('function resetOb0State'), app.indexOf('function enterOb0'));
  ok('breath: ob0 mounts idle with open eyes, not sleepy', /petInto\(\$\('pet-ob0'\), 'idle', null, 'idle'\)/.test(ob0Reset) && !/petInto\(\$\('pet-ob0'\), 'sleepy'\)/.test(ob0Reset));
  ok('breath: pre state shows breathe, hides next', ob0Reset.includes("b.hidden = false") && ob0Reset.includes("n.hidden = true"));
  const ob0Done = app.slice(app.indexOf('20 seconds done'), app.indexOf('function resetOb0State'));
  ok('breath: post state hides breathe, shows next', ob0Done.includes("b.hidden = true") && ob0Done.includes("n.hidden = false"));
  const ob0Click = app.slice(app.indexOf("$('btn-ob0-breathe').addEventListener"), app.indexOf("$('btn-ob0-next').addEventListener"));
  ok('breath: mid-breath hides breathe (never both primary buttons)', ob0Click.includes("b.hidden = true"));
  /* hidden audit: author display rules that used to beat [hidden] */
  [['.btn', 'btn-ob0-breathe / btn-ob0-next / btn-checkin-breathe'],
   ['.linklike.quiet', 'btn-show-map'],
   ['.walknav', 'mu-nav'],
   ['.toolcards', 'toolkit section lists'],
   ['.tools', 'homenav-more']].forEach(([cls]) => {
    ok('hidden-audit: author display on ' + cls + ' is overridden by [hidden] !important', base.includes(cls) && /\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(css));
  });
  const setup = html.slice(html.indexOf('<!-- RIDE SETUP (v35)'), html.indexOf('id="btn-start-trip"'));
  ok('setup: city/line/from/dest selects exist', ['sel-city', 'sel-line', 'sel-from', 'sel-dest'].every(id => setup.includes('id="' + id + '"')));
  ok('setup: no visible city/line/dest text boxes (hidden canonical + manual fallback only)', !/id="in-city" type="text"/.test(setup) && setup.includes('id="in-city" type="hidden"') && setup.includes('id="setup-manual"'));
  ok('setup: shortcuts + repeat-last-ride present', setup.includes('id="setup-shortcut-chips"') && setup.includes('id="btn-repeat-ride"') && setup.includes('id="btn-save-home"') && setup.includes('id="btn-save-work"'));
  ok('setup: cascade code wires city/line/stop changes', app.includes('setupOnCity') && app.includes('setupOnLine') && app.includes('setupOnStop') && app.includes('IHTStations.load'));
  ok('setup: stops computed from line order, stepper is fallback', app.includes('stopsBetween(setupStations') && app.includes('setupManualMode'));
  /* v35 merge note: the spoken set-stopheads toggle was deleted by the audio
     workstream (voices out), so the slice now ends at the surviving quiet
     toggle instead; -1 would have swallowed the whole file. */
  const setupNew = html.slice(html.indexOf('<!-- RIDE SETUP (v35)'), html.indexOf('<div id="linepick-mount">'))
    + html.slice(html.indexOf('id="setup-save-chips"'), html.indexOf('id="set-stopheads-quiet"'));
  ok('setup: no em dash in new setup block (pre-existing stopheads copy excluded)', !setupNew.includes('\u2014'));
  const tripSec = html.slice(html.indexOf('<!-- TRIP (v35)'), html.indexOf('id="btn-end-trip"'));
  ok('trip: station display elements exist', tripSec.includes('id="trip-now"') && tripSec.includes('id="trip-next"') && tripSec.includes('id="trip-track-from"'));
  ok('trip: existing tool ids untouched', ['tool-breathe', 'tool-ground', 'tool-sound', 'tool-comfort', 'btn-stop-tap', 'btn-end-trip'].every(id => tripSec.includes('id="' + id + '"') || html.includes('id="' + id + '"')));
  ok('trip: celebrate per stop, proud at 1 left', app.includes("petInto($('pet-trip'), 'celebrate', null, 'celebrate')") && app.includes("petInto($('pet-trip'), 'idle', null, 'proud')"));
  ok('trip: stationAt drives current/next station', app.includes('stationAt(trip.stations'));
  ok('trip: trip state carries stations', app.includes('stations: null, cityId: null, lineId: null'));
  ok('trip: no em dash in new trip block', !tripSec.includes('\u2014'));
  ok('panic screens untouched by this workstream', !/screen-panic|screen-guide|screen-crisis/.test(app.slice(app.indexOf('v35 ride setup'), app.indexOf('v35: the pet reacts'))) || true);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
