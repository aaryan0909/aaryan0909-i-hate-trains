/* I Hate Trains v51 — "Before you leave": the 2-minute pre-ride ready check.
   Separate module (same pattern as guide.js / calm42.js) so the core app.js
   is barely touched (one mount-map line for the pet; see below).
   Rules held by this module:
   - FREE FOREVER: no paywall, premium, Stripe, or ads anywhere.
   - NO VOICE: sound comes only from the v35 sound pack
     (window.__ihtSound: motif / tap). Never spoken synthesis.
   - Calm time only: offered on the ride-prep checklist, skippable in one
     tap; the panic/crisis/breathe/guide screens are untouched.
   - No scores, no streaks, no grades. The tool pick is a choice, not a grade.
   - One storage key: iht_ready_cue (the rider's cue word, on-device only).
     The tool pick lives only for the current ride (module memory, and only
     for 15 minutes after the check — a stale pick never follows a later ride).
   - Nothing leaves the phone. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function readJSON(k, fb) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function remove(k) { try { localStorage.removeItem(k); } catch (e) {} }
  /* Soft press tick for in-screen controls. Buttons that also carry data-go
     already get the app's own tick from its handler — calling this there
     would double-buzz — so those wires skip it. */
  function tick() {
    try {
      var s = window.__ihtSound;
      if (s) { s.unlock(); s.tap(); }
    } catch (e) {}
  }

  var CUE_KEY = 'iht_ready_cue';
  var PICK_FRESH_MS = 15 * 60 * 1000; // a pick older than this never rides along
  var BREATH_IN_MS = 4000, BREATH_OUT_MS = 6000;

  /* The same 13 tools the rescue sequence offers (app.js SEQ_TOOLS, same
     ids and titles), so the pick matches the journal's tool titles. */
  var READY_TOOLS = [
    { id: 'breathe', title: 'Breathe with me' },
    { id: 'five-senses', title: '5–4–3–2–1 senses' },
    { id: 'three-three-three', title: '3–3–3 noticing' },
    { id: 'muscle-release', title: 'Progressive muscle release' },
    { id: 'kind-words', title: 'Kind, factual words' },
    { id: 'butterfly-hug', title: 'Butterfly taps' },
    { id: 'swipe-breathe', title: 'Swipe breathing' },
    { id: 'trace-calm', title: 'Trace calm' },
    { id: 'hold-steady', title: 'Hold to steady' },
    { id: 'categories', title: 'Quiet category game' },
    { id: 'backwards-count', title: 'Count backward' },
    { id: 'thought-check', title: 'A gentle thought check' },
    { id: 'med-body-scan', title: 'One-minute body scan' }
  ];
  /* Journal breath-pattern titles map to the breathe pick: the journal
     stores the pattern the rider actually used, the ready check offers the
     one breathe door. */
  var BREATH_TITLES = { 'Even square breathing': 1, '4–7–8 breathing': 1, 'Cyclic sigh (optional)': 1 };

  var CUE_PRESETS = ['steady', 'one stop at a time', 'this passes', 'I have done this before'];

  var petName = 'Mochi';
  try { var p = readJSON('iht_pet', null); if (p && p.name) { petName = p.name; } } catch (e) {}

  var step = 0, timers = [], pickedTool = 'breathe', pickedCue = '', readyPick = null;
  /* v52: the breath auto-advance and the step-1 "Next" button occupy the same
     spot. A tap aimed at step 1's Next that lands just after the 10s timer
     re-renders step 2 hits step 2's Next instead and skips the tool pick
     (seen in v51 live QA). So a step shown by the timer ignores Next taps
     for 500ms — long enough for the aimed-at button to settle, short enough
     that a deliberate second tap always works. Manual navigation never sets it. */
  var autoShownAt = 0;
  var reduceMotion = false;
  try { reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

  /* Test seam (not user-facing): the harness shortens the breath timers. */
  var timing = { inMs: BREATH_IN_MS, outMs: BREATH_OUT_MS };

  function clearTimers() { timers.forEach(function (t) { clearTimeout(t); }); timers = []; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function onReadyScreen() { var s = $('screen-ready'); return !!(s && s.classList.contains('active')); }
  function titleFor(id) {
    for (var i = 0; i < READY_TOOLS.length; i++) { if (READY_TOOLS[i].id === id) { return READY_TOOLS[i].title; } }
    return id;
  }

  /* Sound, same pattern as calm42.js: motif on step start, tap on advance,
     with a visible playing indicator and an honest fallback line. */
  function sound(kind, indicatorId) {
    var ok = false;
    try {
      var s = window.__ihtSound;
      if (s) { s.unlock(); ok = (kind === 'start') ? !!s.motif() : !!s.tap(); }
    } catch (e) { ok = false; }
    var ind = indicatorId ? $(indicatorId) : null;
    if (ind) {
      ind.textContent = ok ? '♪ Sound playing' : 'No sound on this phone — follow the words';
      ind.classList.toggle('playing', ok);
      if (ind._t) { clearTimeout(ind._t); }
      ind._t = setTimeout(function () { ind.classList.remove('playing'); }, 900);
    }
    return ok;
  }

  /* Default tool: the rider's most calming tool from iht_journal, counted
     exactly like the v31 top-tools audit — one count per ride per tool, ties
     toward the most recent ride, unknown titles never counted, and never a
     claim until at least three rides have named a tool. Anything else
     defaults to breathe. */
  function topToolId() {
    var byTitle = {};
    READY_TOOLS.forEach(function (t) { byTitle[t.title] = t.id; });
    try {
      var log = readJSON('iht_journal', []);
      var counts = {}, lastSeen = {}, ridesNamed = 0;
      log.forEach(function (e, idx) {
        if (!e || !e.tools || !e.tools.length) { return; }
        ridesNamed++;
        var seen = {};
        e.tools.forEach(function (title) {
          if (seen[title]) { return; } seen[title] = true;
          var id = byTitle[title] || (BREATH_TITLES[title] ? 'breathe' : null);
          if (!id) { return; }
          counts[id] = (counts[id] || 0) + 1;
          lastSeen[id] = idx;
        });
      });
      if (ridesNamed < 3) { return null; }
      var best = null;
      Object.keys(counts).forEach(function (id) {
        if (!best || counts[id] > counts[best] ||
            (counts[id] === counts[best] && lastSeen[id] > lastSeen[best])) { best = id; }
      });
      return best;
    } catch (e) { return null; }
  }

  /* ---------- step 1: one slow breath with the pet ---------- */
  function startBreath() {
    var cue = $('ready-breath-cue'), wrap = $('ready-pet-wrap');
    $all('.ready-petname').forEach(function (el) { el.textContent = petName; });
    if (wrap) { wrap.classList.remove('ready-in', 'ready-out'); }
    sound('start', 'ready-ind');
    if (!cue) { return; }
    if (reduceMotion) {
      /* No auto-motion: the cue sits still and the rider advances by hand. */
      cue.textContent = 'Breathe in… and out… nice and slow.';
      return;
    }
    cue.textContent = 'Breathe in…';
    if (wrap) { wrap.classList.add('ready-in'); }
    later(function () {
      if (!onReadyScreen() || step !== 1) { return; }
      cue.textContent = '…and out…';
      if (wrap) { wrap.classList.remove('ready-in'); wrap.classList.add('ready-out'); }
      later(function () {
        if (!onReadyScreen() || step !== 1) { return; }
        if (wrap) { wrap.classList.remove('ready-out'); }
        showStep(2, { auto: true });
      }, timing.outMs);
    }, timing.inMs);
  }

  /* ---------- step 2: pick your tool for this ride ---------- */
  function renderTools() {
    var host = $('ready-tools');
    if (!host) { return; }
    host.innerHTML = '';
    var top = topToolId();
    pickedTool = top || 'breathe';
    READY_TOOLS.forEach(function (t) {
      var c = document.createElement('button');
      c.className = 'chip'; c.type = 'button';
      c.setAttribute('aria-pressed', t.id === pickedTool ? 'true' : 'false');
      c.setAttribute('data-tool', t.id);
      c.textContent = t.title;
      c.addEventListener('click', function () {
        tick();
        pickedTool = t.id;
        $all('#ready-tools .chip').forEach(function (x) {
          x.setAttribute('aria-pressed', x.getAttribute('data-tool') === pickedTool ? 'true' : 'false');
        });
      });
      host.appendChild(c);
    });
    var note = $('ready-default-note');
    if (note) {
      note.textContent = top
        ? 'Picked because it has helped you most. Change it if today feels different.'
        : 'Pick any — Breathe with me is a good place to start.';
    }
  }

  /* ---------- step 3: one cue word + a glance at the backup plan ---------- */
  function renderCues() {
    var host = $('ready-cues');
    if (!host) { return; }
    host.innerHTML = '';
    CUE_PRESETS.forEach(function (word) {
      var c = document.createElement('button');
      c.className = 'chip'; c.type = 'button';
      c.setAttribute('aria-pressed', pickedCue === word ? 'true' : 'false');
      c.textContent = '“' + word + '”';
      c.addEventListener('click', function () {
        tick();
        pickedCue = word;
        var input = $('in-ready-cue');
        if (input) { input.value = word; }
        $all('#ready-cues .chip').forEach(function (x) {
          x.setAttribute('aria-pressed', x.textContent === '“' + word + '”' ? 'true' : 'false');
        });
      });
      host.appendChild(c);
    });
  }
  function renderPlanGlance() {
    var line = $('ready-plan-line');
    if (!line) { return; }
    var bits = [];
    try {
      var plan = readJSON('iht_plan', null) || {};
      if (plan.exit) { bits.push('get off at ' + String(plan.exit).slice(0, 40)); }
      if (plan.reachName) { bits.push('call ' + String(plan.reachName).slice(0, 40)); }
    } catch (e) {}
    line.textContent = bits.length
      ? 'Your plan: ' + bits.join(', ') + '.'
      : 'No backup plan saved yet — you can set one in calm time, from the toolkit.';
  }

  /* ---------- step plumbing ---------- */
  function showStep(n, opts) {
    clearTimers();
    step = n;
    autoShownAt = (opts && opts.auto) ? Date.now() : 0;
    var count = $('ready-count');
    if (count) { count.textContent = 'Step ' + n + ' of 3'; }
    [1, 2, 3].forEach(function (i) {
      var el = $('ready-step' + i);
      if (el) { el.hidden = (i !== n); }
    });
    if (n === 1) { startBreath(); }
    if (n === 2) { renderTools(); }
    if (n === 3) {
      renderCues();
      renderPlanGlance();
      var input = $('in-ready-cue');
      if (input && !input.value) { input.value = pickedCue; }
    }
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function openReady() {
    pickedCue = read(CUE_KEY) || '';
    var input = $('in-ready-cue');
    if (input) { input.value = pickedCue; }
    showStep(1);
  }

  function finishReady() {
    pickedCue = (($('in-ready-cue') || {}).value || '').trim().slice(0, 40);
    if (pickedCue) { store(CUE_KEY, pickedCue); } else { remove(CUE_KEY); }
    readyPick = { tool: pickedTool, cue: pickedCue, at: Date.now() };
  }

  /* ---------- the pick rides along to the trip screen ---------- */
  function applyReadyLine() {
    var line = $('trip-ready-line');
    if (!line) { return; }
    if (readyPick && (Date.now() - readyPick.at) <= PICK_FRESH_MS) {
      var text = 'Your tool for this ride: ' + titleFor(readyPick.tool) + '.';
      if (readyPick.cue) { text += ' Your word: “' + readyPick.cue + '”.'; }
      line.textContent = text;
      line.hidden = false;
    } else {
      line.hidden = true;
    }
  }
  function clearReadyPick() {
    readyPick = null;
    var line = $('trip-ready-line');
    if (line) { line.hidden = true; }
  }

  /* ---------- wiring ---------- */
  function wire(id, fn) {
    var el = $(id);
    if (el) { el.addEventListener('click', fn); }
  }
  function nextGuarded(n) {
    /* v52: swallow a Next tap that lands within 500ms of a timer-driven step
       change — it was aimed at the previous step's button, not this one. */
    if (autoShownAt && (Date.now() - autoShownAt) < 500) { return; }
    tick();
    showStep(n);
  }
  wire('btn-ready-start', function () { openReady(); });
  wire('btn-ready-next1', function () { nextGuarded(2); });
  wire('btn-ready-next2', function () { nextGuarded(3); });
  wire('btn-ready-back2', function () { tick(); showStep(1); });
  wire('btn-ready-back3', function () { tick(); showStep(2); });
  wire('btn-ready-finish', function () { finishReady(); });
  wire('btn-start-trip', function () { applyReadyLine(); });
  wire('btn-end-trip', function () { clearReadyPick(); });
  wire('btn-im-home', function () { clearReadyPick(); });
  var cueInput = $('in-ready-cue');
  if (cueInput) {
    cueInput.addEventListener('input', function () {
      pickedCue = cueInput.value;
      $all('#ready-cues .chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    });
  }

  /* Test seam: the harness reads the pick and shortens the breath timers. */
  window.__ihtReady = {
    open: openReady, showStep: showStep, topTool: topToolId,
    pick: function () { return readyPick; },
    state: function () { return { step: step, tool: pickedTool, cue: pickedCue }; },
    timing: timing
  };
})();
