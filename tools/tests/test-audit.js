/* Dead-button + navigation audit for I Hate Trains (backlog item, Aaryan direct
   ask 2026-10-11). Boots the real index.html + all JS modules in jsdom and
   crawls the UI by clicking: every visible control on every reachable screen
   must do something visible (navigate, change the DOM, change storage, or fire
   a recorded external/share/print call). A control that changes nothing is
   reported DEAD. Screens with no exit are reported as dead ends.
   Timers are faked (queued, drained selectively) so the 8s panic freeze never
   fires mid-crawl; the freeze itself is covered by tools/tests/test-freeze.js.
   Each control is tested in its own fresh boot (replay the click-path that
   reaches its screen), so tests are independent. Windows are closed after use
   and snapshots are digests, to keep the crawl inside Node's heap.
   Boots are async: after eval the harness yields one event-loop turn so
   jsdom fires its REAL DOMContentLoaded once (calm42's wire() and auth.js
   init() run exactly once, like a browser). Yielding also lets jsdom
   release closed windows, which otherwise pile up ~5MB each and OOM the
   crawl (found by boot benchmark 2026-11-25).
   Timers run on a virtual clock (see buildBoot), so draining is bounded
   even for self-rescheduling loops like the pet blink loop.
   The ride flow (setup selects need real values) is driven by a scripted
   action list after the BFS.
   screen-trimap is the one screen this crawl cannot reach: it needs the
   TriMap map-chooser pick (TriMap.current.useMap), and the scripted flow
   uses the plain selects. That path is covered by
   tools/tests/test-trimap.js instead; "Unvisited: screen-trimap" here is
   expected, not a gap.
   Usage: node tools/tests/test-audit.js (run from repo root or tools/tests) */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULES = ['drift.js', 'trimap.js', 'crisis.js', 'metros.js', 'stations.js',
  'sound.js', 'app.js', 'stopheads.js', 'guide.js', 'calm42.js', 'ready.js', 'platform.js', 'auth.js'];
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SRC = {};
MODULES.forEach(f => { SRC[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); });
const TTC = fs.readFileSync(path.join(ROOT, 'ttc.json'), 'utf8');
const TTC_DATA = JSON.parse(TTC);
const STATION_FILES = {};
fs.readdirSync(path.join(ROOT, 'stations')).forEach(f => {
  if (/\.json$/.test(f)) { try { STATION_FILES[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(ROOT, 'stations', f), 'utf8')); } catch (e) {} }
});
const ALL_SCREENS = Array.from(HTML.matchAll(/id="(screen-[a-z0-9-]+)"/g)).map(m => m[1]);
let bootCount = 0;

const dead = [];
const broken = [];
const deadEnds = [];
const notes = [];
const edges = [];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
// Yield to the event loop: jsdom releases closed windows only on a loop turn
// (its load/DOMContentLoaded tasks retain them otherwise — ~5MB per boot).
// Also lets jsdom fire its REAL DOMContentLoaded once after eval, which is
// how calm42's wire() and auth.js init() run (exactly once, like a browser).
const tick = () => new Promise(r => setImmediate(r));

async function buildBoot(seed, drainMs) {
  // jsdom windows pile up under a tight synchronous loop (no idle time for
  // V8 to collect); force a collection regularly when --expose-gc is on.
  if (typeof global !== 'undefined' && global.gc) {
    bootCount = (bootCount || 0) + 1;
    if (bootCount % 50 === 0) { try { global.gc(); } catch (e) {} }
  }
  const queue = [];
  let timerId = 0;
  let now = 0; // virtual clock (ms) for the fake timers above
  const calls = { share: [], print: 0, open: [], vibrate: 0, clipboard: null };
  // Listener exceptions never propagate out of el.click() in jsdom; they
  // land here. tryControl treats a new jsdomError during a control's action
  // as BROKEN (this is how the plan.pocket crash was caught, 2026-11-25).
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', e => { const m = String(e && e.stack || e && e.message || e).split('\n').slice(0, 4).join(' | '); if (!/Not implemented: navigation/.test(m)) errors.push(m); });
  const dom = new JSDOM(HTML, {
    url: (seed && seed.url) || 'https://i-hate-trains-aaryan0909s-projects.vercel.app/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.IHT_ACCOUNT_CONFIG = { supabaseUrl: 'https://YOUR-PROJECT.supabase.co', supabaseAnonKey: 'YOUR-SUPABASE-ANON-KEY', localPreview: false };
      // AudioContext mock rich enough for sound.js (AudioParams with ramp
      // methods, filters, compressor, buffers) so ambient toggles work.
      const audioParam = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
      const audioNode = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, frequency: audioParam(), gain: audioParam(), Q: audioParam(), detune: audioParam(), playbackRate: audioParam(), type: '', buffer: null, loop: false });
      window.AudioContext = function () {
        return {
          createOscillator: audioNode, createGain: audioNode, createBufferSource: audioNode,
          createBiquadFilter: audioNode, createDynamicsCompressor: audioNode,
          createDelay: audioNode, createAnalyser: audioNode, createStereoPanner: audioNode,
          createBuffer: (ch, len, rate) => ({ numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: () => new Float32Array(len) }),
          decodeAudioData: () => Promise.resolve({}),
          currentTime: 0, sampleRate: 44100, destination: {}, state: 'running',
          resume: () => Promise.resolve(), suspend: () => Promise.resolve(), close: () => Promise.resolve(),
        };
      };
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      window.confirm = () => true;
      window.alert = () => {};
      window.scrollTo = () => {};
      window.navigator.geolocation = {
        watchPosition() { return 1; }, clearWatch() {},
        getCurrentPosition(s) { s({ coords: { latitude: 43.65, longitude: -79.38 } }); }
      };
      window.navigator.vibrate = () => { calls.vibrate++; return true; };
      window.navigator.share = (d) => { calls.share.push(d); return Promise.resolve(); };
      // Sync thenable: the app's clipboard .then() updates the hint inline;
      // a real promise would never settle in this synchronous harness.
      window.navigator.clipboard = { writeText: (t) => { calls.clipboard = t; return { then(cb) { try { cb && cb(); } catch (e) {} return this; }, catch() { return this; } }; } };
      window.print = () => { calls.print++; };
      window.open = (u) => { calls.open.push(u); return null; };
      window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
      // Synchronous thenables: stations.js / trimap.js use pure .then chains,
      // so resolving inline keeps the harness synchronous (it never yields to
      // the event loop, so real promises would never settle).
      const syncVal = (v) => ({
        then(cb) { let out; try { out = cb ? cb(v) : v; } catch (e) { return syncRej(e); } return (out && typeof out.then === 'function') ? out : syncVal(out); },
        catch() { return this; },
      });
      const syncRej = (e) => ({
        then(cb, eb) { if (!eb) return syncRej(e); let out; try { out = eb(e); } catch (e2) { return syncRej(e2); } return (out && typeof out.then === 'function') ? out : syncVal(out); },
        catch(cb) { let out; try { out = cb(e); } catch (e2) { return syncRej(e2); } return (out && typeof out.then === 'function') ? out : syncVal(out); },
      });
      window.fetch = function (u) {
        const s = String(u);
        let data = null, ok = false;
        if (s.indexOf('ttc.json') !== -1) { data = TTC_DATA; ok = true; }
        else {
          const m = s.match(/stations\/([a-z]+)\.json/);
          if (m && STATION_FILES[m[1]]) { data = STATION_FILES[m[1]]; ok = true; }
        }
        return syncVal({ ok, status: ok ? 200 : 404, json: () => syncVal(data) });
      };
      // Virtual clock: timers store an absolute due time (now + delay) so
      // drain() only fires what is due inside the window. The old version
      // compared the raw delay against the window, so drain(21000) on the
      // onboarding breath screen looped the pet blink timer forever.
      window.setTimeout = (fn, ms) => { const id = ++timerId; queue.push({ id, fn, ms: ms || 0, at: now + (ms || 0) }); return id; };
      window.clearTimeout = (id) => { const i = queue.findIndex(q => q.id === id); if (i >= 0) queue.splice(i, 1); };
      window.setInterval = (fn, ms) => { const id = ++timerId; queue.push({ id, fn, ms: ms || 0, at: now + (ms || 0), iv: true }); return id; };
      window.clearInterval = window.clearTimeout;
    }
  });
  const w = dom.window;
  const d = w.document;
  if (seed) {
    if (seed.onboarded) w.localStorage.setItem('iht_onboarded', '1');
    if (seed.journal) w.localStorage.setItem('iht_journal', JSON.stringify(seed.journal));
    if (seed.plan) w.localStorage.setItem('iht_plan', JSON.stringify(seed.plan));
    if (seed.seq) w.localStorage.setItem('iht_rescue_seq', JSON.stringify(seed.seq));
  }
  MODULES.forEach(f => w.eval(SRC[f]));
  await tick(); // jsdom fires its real DOMContentLoaded now (wire/init run once)
  function drain(maxMs, limit) {
    let n = 0;
    const end = now + maxMs;
    while (n < (limit || 500)) {
      let bi = -1, bt = Infinity;
      queue.forEach((q, i) => { if (q.at <= end && q.at < bt) { bt = q.at; bi = i; } });
      if (bi < 0) break;
      const q = queue.splice(bi, 1)[0];
      n++;
      now = q.at;
      try { q.fn(); } catch (e) { /* timer errors are not the audit's subject */ }
      if (q.iv) queue.push({ id: q.id, fn: q.fn, ms: q.ms, at: now + q.ms, iv: true });
    }
    return n;
  }
  drain(drainMs === undefined ? 2600 : drainMs); // splash floor + boot settle
  return { w, d, calls, errors, drain, close() { try { w.close(); } catch (e) {} } };
}

function activeScreen(d) {
  const s = d.querySelector('.screen.active');
  return s ? s.id : null;
}
function isVisible(el, d) {
  if (!el || el.hidden) return false;
  let n = el;
  while (n && n !== d.body) {
    if (n.hidden) return false;
    if (n.style && (n.style.display === 'none' || n.style.visibility === 'hidden')) return false;
    n = n.parentElement;
  }
  const scr = el.closest('.screen');
  if (scr) return scr.classList.contains('active');
  return true;
}
function label(el) {
  const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48);
  return (el.id ? '#' + el.id : el.tagName.toLowerCase()) + (t ? ' "' + t + '"' : '');
}
function snapshot(w) {
  const ls = {};
  for (let i = 0; i < w.localStorage.length; i++) {
    const k = w.localStorage.key(i); ls[k] = w.localStorage.getItem(k);
  }
  // Form values are NOT in innerHTML — include them explicitly.
  const vals = Array.from(w.document.querySelectorAll('input, select, textarea')).map(e =>
    (e.id || e.name || e.tagName) + '=' + (e.type === 'checkbox' || e.type === 'radio' ? !!e.checked : e.value)).join(';');
  return hash(activeScreen(w.document) + '|' + w.document.body.innerHTML + '|' + JSON.stringify(ls) + '|' + vals);
}
function snapCalls(calls) {
  return JSON.stringify({ share: calls.share.length, print: calls.print, open: calls.open.length, vibrate: calls.vibrate, clipboard: !!calls.clipboard });
}
function controlsOn(d) {
  const scr = d.querySelector('.screen.active');
  const scope = scr || d.body;
  const els = Array.from(scope.querySelectorAll('button, a, input, select, textarea, summary, [role="button"]'));
  const sos = d.getElementById('sos-float');
  if (sos && isVisible(sos, d)) els.push(sos);
  // Hidden inputs are storage, not controls.
  return els.filter(e => isVisible(e, d) && !(e.tagName === 'INPUT' && e.type === 'hidden'));
}
function selectorFor(el, d) {
  if (el.id) return { kind: 'id', value: el.id };
  const go = el.getAttribute && el.getAttribute('data-go');
  if (go) return { kind: 'go', value: go };
  // Text selectors survive re-renders of dynamic lists (sensation rate
  // grid, ready tool chips, toolkit groups); index selectors do not —
  // they replayed onto the wrong control and the target screen was never
  // reached. `occ` disambiguates duplicate labels.
  const lab = label(el);
  if (lab) {
    const list = controlsOn(d);
    const occ = list.filter(e => label(e) === lab).indexOf(el);
    return { kind: 'text', value: lab, occ };
  }
  const list = controlsOn(d);
  return { kind: 'idx', value: list.indexOf(el), label: lab };
}
function resolveStep(d, step) {
  if (step.kind === 'id') return d.getElementById(step.value);
  if (step.kind === 'go') return d.querySelector('[data-go="' + step.value + '"]');
  if (step.kind === 'text') {
    const list = controlsOn(d).filter(e => label(e) === step.value);
    return list[step.occ || 0] || null;
  }
  const list = controlsOn(d);
  return list[step.value] || null;
}
function fire(el, w, type) {
  try {
    const ev = new w.Event(type, { bubbles: true, cancelable: true });
    // Swipe/gesture handlers read these; a bare Event leaves them undefined
    // and throws inside the listener (jsdom reports, does not propagate).
    if (/^touch/.test(type)) {
      Object.defineProperty(ev, 'touches', { value: [] });
      Object.defineProperty(ev, 'changedTouches', { value: [] });
    }
    if (/^(pointer|mouse)/.test(type)) {
      Object.defineProperty(ev, 'clientX', { value: 0 });
      Object.defineProperty(ev, 'clientY', { value: 0 });
    }
    el.dispatchEvent(ev);
  } catch (e) {}
}
function doClick(boot, el) {
  // Pointer/mouse press + release, then click: hold-to-tense and other
  // pointer-driven controls need the down/up pair, not just click.
  fire(el, boot.w, 'pointerdown'); fire(el, boot.w, 'mousedown');
  if (el.tagName === 'BUTTON' && el.type === 'submit' && el.form) {
    el.form.dispatchEvent(new boot.w.Event('submit', { bubbles: true, cancelable: true }));
  } else {
    el.click();
  }
  fire(el, boot.w, 'mouseup'); fire(el, boot.w, 'pointerup');
  fire(el, boot.w, 'touchstart'); fire(el, boot.w, 'touchend');
}
function tryControl(boot, el) {
  const w = boot.w, d = boot.d;
  // External links (tel:/sms:/https:) can't be followed in jsdom — clicking
  // one only logs "Not implemented: navigation". Verify the href instead.
  const href0 = el.getAttribute && el.getAttribute('href');
  if (href0 && /^(https?:|tel:|mailto:|sms:)/.test(href0)) {
    return { error: null, to: activeScreen(d), changed: false, external: true, href: href0 };
  }
  const before = snapshot(w);
  const beforeCalls = snapCalls(boot.calls);
  const errBefore = boot.errors.length;
  const wasPressed = !!(el.getAttribute && el.getAttribute('aria-pressed') === 'true');
  let error = null;
  let performed = null; // replayable form of what this control did (inputs/selects)
  const cssId = el.id ? ('#' + el.id) : null;
  try {
    if (el.tagName === 'SELECT') {
      if (el.options.length > 1) el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
      el.dispatchEvent(new w.Event('change', { bubbles: true }));
      if (cssId) performed = [{ select: cssId, index: el.selectedIndex }];
    } else if (el.tagName === 'INPUT' && /^(text|tel|email|url|search|number)$/.test(el.type || 'text')) {
      el.focus();
      el.value = el.value ? el.value + 'x' : 'test';
      el.dispatchEvent(new w.Event('input', { bubbles: true }));
      el.dispatchEvent(new w.Event('change', { bubbles: true }));
      if (cssId) performed = [{ set: cssId, value: el.value }];
    } else if (el.tagName === 'TEXTAREA') {
      el.focus();
      el.value = el.value ? el.value + ' x' : 'test note';
      el.dispatchEvent(new w.Event('input', { bubbles: true }));
      el.dispatchEvent(new w.Event('change', { bubbles: true }));
      if (cssId) performed = [{ set: cssId, value: el.value }];
    } else {
      doClick(boot, el);
    }
  } catch (e) { error = e; }
  boot.drain(3000);
  if (boot.errors.length > errBefore) error = error || new Error(boot.errors[errBefore]);
  const after = snapshot(w);
  const afterCalls = snapCalls(boot.calls);
  const changed = before !== after || beforeCalls !== afterCalls;
  const href = el.getAttribute && el.getAttribute('href');
  const external = href && /^(https?:|tel:|mailto:|sms:)/.test(href);
  return { error, to: activeScreen(d), changed, external, href, wasPressed, performed };
}

const SEED = {
  onboarded: true,
  journal: [
    { date: '2026-11-20', tool: '5–4–3–2–1 senses', after: 'calmer', note: 'Test ride one.' },
    { date: '2026-11-22', tool: '5–4–3–2–1 senses', after: 'calmer', note: 'Test ride two.' },
    { date: '2026-11-23', tool: 'Box breathing', after: 'same', note: 'Test ride three.' },
  ],
  plan: { reach: 'text Maya', reachName: 'Maya', reachPhone: '4165550123', comfort: '', local: '' },
  seq: ['senses', 'breathe'],
};

// ---- shared per-screen tester: fresh boot + path, enumerate + test controls ----
// A path is a list of actions:
//   {sel}    click a control resolved by selector (BFS edges)
//   {click}  click document.querySelector(sel) (scripted flows)
//   {select} set a <select> value by option text or index, then change (flows)
const visited = new Set();
const testedPaths = new Set(); // screen + JSON(path): same screen via another path re-tests
const tested = new Set();
let screensExplored = 0, controlsTested = 0, testCalls = 0, capNoted = false;

function runActions(boot, actions) {
  for (const a of actions) {
    if (a.sel) {
      const el = resolveStep(boot.d, a.sel);
      if (!el) return 'missing ' + JSON.stringify(a.sel);
      try { doClick(boot, el); } catch (e) { return 'click threw on ' + JSON.stringify(a.sel) + ': ' + e.message; }
      boot.drain(1500);
      continue;
    }
    if (a.set) {
      const el = boot.d.querySelector(a.set);
      if (!el) return 'set target missing ' + a.set;
      el.value = a.value;
      el.dispatchEvent(new boot.w.Event('input', { bubbles: true }));
      el.dispatchEvent(new boot.w.Event('change', { bubbles: true }));
      boot.drain(1500);
      continue;
    }
    if (a.select) {
      const el = boot.d.querySelector(a.select);
      if (!el) return 'select missing ' + a.select;
      if (a.text !== undefined) {
        const opt = Array.from(el.options).find(o => o.textContent.trim().includes(a.text) || o.value === a.text);
        if (!opt) return 'option ' + a.text + ' not in ' + a.select + ' (has: ' + Array.from(el.options).map(o => o.textContent.trim()).join('|') + ')';
        el.value = opt.value;
      } else if (a.index !== undefined) {
        if (a.index >= el.options.length) return 'index ' + a.index + ' out of range for ' + a.select;
        el.selectedIndex = a.index;
      }
      el.dispatchEvent(new boot.w.Event('change', { bubbles: true }));
      boot.drain(1500);
      continue;
    }
    if (a.click) {
      const el = boot.d.querySelector(a.click);
      if (!el) return 'click target missing ' + a.click + ' on ' + activeScreen(boot.d);
      try { doClick(boot, el); } catch (e) { return 'click threw ' + a.click + ': ' + e.message; }
      boot.drain(1500);
      continue;
    }
    return 'unknown action ' + JSON.stringify(a);
  }
  return null;
}

const bootErrNoted = new Set();
const expandedToggles = new Set(); // screen + toggleSel: expand each toggle once, globally
const sosByScreen = {};            // screen -> SOS float visible?
const jobQueue = [];               // shared BFS queue (testScreen pushes edges/toggles)

async function testScreen(job, seed) {
  seed = seed || job.seed || SEED;
  if (++testCalls > 600) {
    if (!capNoted) { capNoted = true; notes.push('SAFETY CAP: stopped after 600 screen tests; coverage may be partial'); }
    return null;
  }
  let boot = await buildBoot(seed, job.drainMs);
  const rErr = runActions(boot, job.path);
  if (rErr) { notes.push('replay failed for ' + (job.screen || 'start') + ': ' + rErr); boot.close(); return null; }
  const cur = activeScreen(boot.d);
  if (!cur) { notes.push('boot landed on no active screen (path: ' + JSON.stringify(job.path) + ')'); boot.close(); return null; }
  if (cur === 'screen-ob0') boot.drain(21000); // guided breath is 4+6+4+6s; Next only appears after it
  const pathKey = cur + '|' + JSON.stringify(job.path) + '|' + (job.drainMs || '');
  if (testedPaths.has(pathKey)) { boot.close(); return cur; }
  testedPaths.add(pathKey);
  const firstVisit = !visited.has(cur);
  visited.add(cur);
  if (boot.errors.length && !bootErrNoted.has(cur)) { bootErrNoted.add(cur); notes.push(cur + ': boot jsdomErrors: ' + boot.errors.slice(0, 3).join(' | ')); }
  if (firstVisit) screensExplored++;
  const sosEl = boot.d.getElementById('sos-float');
  if (!(cur in sosByScreen)) sosByScreen[cur] = !!(sosEl && isVisible(sosEl, boot.d));
  const toggles = []; // {sel, prior}: controls that changed the DOM without navigating
  let actionsSoFar = []; // in-screen {sel} clicks in THIS boot, in order
  // Sequential pass: one boot per screen; re-boot only when a control
  // navigates away. Re-enumerate after every DOM change (toggles reveal
  // controls) and after every return from a navigation.
  for (;;) {
    if (activeScreen(boot.d) !== cur) { notes.push(cur + ': left the screen unexpectedly'); break; }
    const remaining = controlsOn(boot.d)
      .map(el => ({ sel: selectorFor(el, boot.d), lab: label(el), disabled: !!el.disabled }))
      .filter(c => !tested.has(cur + ' :: ' + c.lab));
    if (!remaining.length) break;
    let navigated = false, changedDom = false;
    for (const c of remaining) {
      const key = cur + ' :: ' + c.lab;
      if (tested.has(key)) continue;
      tested.add(key);
      controlsTested++;
      if (c.disabled) { notes.push(cur + ': disabled control ' + c.lab + ' (by design?)'); continue; }
      const el = resolveStep(boot.d, c.sel);
      if (!el) { notes.push('control vanished: ' + key); continue; }
      const r = tryControl(boot, el);
      if (r.error) { broken.push({ screen: cur, control: c.lab, error: String(r.error && r.error.message || r.error) }); continue; }
      const acts = r.performed || [{ sel: c.sel }]; // replayable form of this action
      if (r.to && r.to !== cur) {
        edges.push({ from: cur, control: c.lab, to: r.to });
        if (!visited.has(r.to)) jobQueue.push({ screen: r.to, path: job.path.concat(actionsSoFar).concat(acts), seed });
        navigated = true;
        break;
      }
      if (r.changed) {
        const tk = cur + '|' + JSON.stringify(c.sel);
        if (!expandedToggles.has(tk)) { expandedToggles.add(tk); toggles.push({ acts, prior: actionsSoFar.slice() }); }
        actionsSoFar.push.apply(actionsSoFar, acts);
        changedDom = true;
        break; // re-enumerate: labels may have shifted
      }
      if (r.external) { notes.push(cur + ': external link ' + c.lab + ' -> ' + r.href); continue; }
      // Already-selected segmented/chip controls (aria-pressed) are no-ops
      // by design: clicking the active segment changes nothing, correctly.
      if (r.wasPressed) { notes.push(cur + ': already-selected control ' + c.lab + ' (no-op by design)'); continue; }
      dead.push({ screen: cur, control: c.lab, why: 'click changed nothing (no nav, no DOM/storage/call change)' });
    }
    if (navigated) {
      boot.close();
      actionsSoFar = []; // fresh boot: state is job.path only again
      boot = await buildBoot(seed, job.drainMs);
      const e2 = runActions(boot, job.path);
      if (e2 || activeScreen(boot.d) !== cur) { notes.push('could not return to ' + cur + ' after a navigation'); boot.close(); return cur; }
    }
    void changedDom;
  }
  boot.close();
  // Re-test this screen with each toggle applied, so controls it reveals
  // (e.g. the home More menu) get enumerated and tested too.
  const inPath = new Set(job.path.map(a => JSON.stringify(a.sel || a)));
  toggles.forEach(t => {
    if (t.acts.some(a => inPath.has(JSON.stringify(a.sel || a)))) return;
    if (jobQueue.length > 500) { notes.push('job cap hit, toggle expansion stopped on ' + cur); return; }
    jobQueue.push({ screen: cur, path: job.path.concat(t.prior).concat(t.acts), seed, drainMs: job.drainMs });
  });
  return cur;
}

// ---- BFS over the click graph ----
(async () => {

jobQueue.push({ screen: null, path: [] });
while (jobQueue.length) {
  await testScreen(jobQueue.shift());
}

// ---- Scripted ride flow (setup selects need real values) ----
const FLOW_TO_TRIP = [
  { click: '#btn-start-ride' },                    // -> checkin
  { click: '[data-feel="steady"]' },
  { click: '#btn-checkin-continue' },              // -> checklist
  { click: '#screen-checklist [data-go="screen-setup"]' }, // skip ready -> setup
  { select: '#sel-city', text: 'Toronto' },
  { select: '#sel-line', index: 1 },
  { select: '#sel-from', index: 0 },
  { select: '#sel-dest', index: 5 },
  { click: '#btn-start-trip' },                    // -> trip
];
const FLOW_SCREENS = [
  { name: 'screen-checkin', actions: FLOW_TO_TRIP.slice(0, 1) },
  { name: 'screen-checklist', actions: FLOW_TO_TRIP.slice(0, 3) },
  { name: 'screen-setup', actions: FLOW_TO_TRIP.slice(0, 4) },
  { name: 'screen-trip', actions: FLOW_TO_TRIP },
  { name: 'screen-arrived', actions: FLOW_TO_TRIP.concat([{ click: '#btn-end-trip' }]) },
  { name: 'screen-reflect', actions: FLOW_TO_TRIP.concat([{ click: '#btn-end-trip' }, { click: '#btn-im-home' }]) },
  { name: 'screen-ready', actions: FLOW_TO_TRIP.slice(0, 3).concat([{ click: '#btn-ready-start' }]) },
  { name: 'screen-platform', actions: FLOW_TO_TRIP.slice(0, 4).concat([{ click: '#btn-platform-start' }]) },
];
for (const fscreen of FLOW_SCREENS) {
  if (visited.has(fscreen.name)) continue;
  // Probe the flow lands where expected, then test via the shared tester.
  const probe = await buildBoot(SEED);
  const perr = runActions(probe, fscreen.actions);
  const landed = perr ? ('ERR ' + perr) : activeScreen(probe.d);
  probe.close();
  if (landed !== fscreen.name) { notes.push('flow to ' + fscreen.name + ' landed on ' + landed + ' instead'); continue; }
  await testScreen({ screen: fscreen.name, path: fscreen.actions });
}
// Any screens the flow exposed get BFS-tested too.
while (jobQueue.length) {
  await testScreen(jobQueue.shift());
}

// ---- Fresh boot: onboarding + splash (no onboarded flag) ----
const SEED_FRESH = {};
// Splash first: boot without the settle drain, so the splash is still up.
await testScreen({ screen: 'screen-splash', path: [], seed: SEED_FRESH, drainMs: 0 });
const freshQueue = [{ screen: null, path: [], seed: SEED_FRESH }];
while (freshQueue.length) {
  const j = freshQueue.shift();
  // testScreen pushes onto the shared jobQueue; drain those into freshQueue
  // so the fresh run stays on the fresh seed.
  const before = jobQueue.length;
  await testScreen(j);
  while (jobQueue.length > before) freshQueue.push(jobQueue.splice(before, 1)[0]);
}
while (jobQueue.length) {
  await testScreen(jobQueue.shift());
}

console.log('\nScreens reached: ' + visited.size + ' / ' + ALL_SCREENS.length);
console.log('Unvisited screens: ' + ALL_SCREENS.filter(s => !visited.has(s)).join(', '));
console.log('Screens explored: ' + screensExplored + ' | Controls tested: ' + controlsTested);
console.log('Edges found: ' + edges.length);
console.log('\nDEAD controls (' + dead.length + '):');
dead.forEach(x => console.log('  - ' + x.screen + ' :: ' + x.control + ' — ' + x.why));
console.log('\nBROKEN controls (' + broken.length + '):');
broken.forEach(x => console.log('  - ' + x.screen + ' :: ' + x.control + ' — ' + x.error));
const finalDeadEnds = ALL_SCREENS.filter(x => visited.has(x) && !edges.some(e => e.from === x) && !sosByScreen[x]);
console.log('\nDEAD-END screens (' + finalDeadEnds.length + '):');
finalDeadEnds.forEach(x => console.log('  - ' + x));
console.log('\nNotes (' + notes.length + '):');
notes.slice(0, 80).forEach(n => console.log('  * ' + n));
const pass = dead.length === 0 && broken.length === 0 && finalDeadEnds.length === 0;
console.log('\n' + (pass ? 'AUDIT CLEAN' : 'AUDIT FOUND ISSUES'));
process.exit(pass ? 0 : 1);
})();
