/* I Hate Trains v54 — "The platform minute": the wait on the platform.
   Separate module (same pattern as ready.js / calm42.js) so the core app.js
   is barely touched (one mount-map line + one pet-line entry + one go()
   hook that stops the pad when the rider leaves the platform screen for
   anywhere but the trip).
   Rules held by this module:
   - FREE FOREVER: no paywall, premium, Stripe, or ads anywhere.
   - NO VOICE: sound comes only from the v35 sound pack (the ambient pad
     via window.__ihtSound). Never spoken synthesis.
   - Calm time only: offered on ride setup, one screen, zero decisions.
     The panic/crisis/breathe/guide screens are untouched.
   - No scores, no streaks, no grades. Nothing is tracked or counted.
   - Reads one key only: iht_ready_cue (the cue word, saved by the ready
     check). No new storage keys. Nothing leaves the phone.
   - The pad is global ambient, started and stopped by the one toggle.
     Leaving the screen stops it — app.js go() already stops ambient on
     every navigation (stopBreathe), so the pad never drones on a screen
     with no sound control, and the trip screen's own one-tap sound button
     (synced by sound.js) takes over once aboard. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  var CUE_KEY = 'iht_ready_cue';
  var BREATH_IN_MS = 4000, BREATH_OUT_MS = 6000;

  var petName = 'Mochi';
  try { var p = JSON.parse(localStorage.getItem('iht_pet')); if (p && p.name) { petName = p.name; } } catch (e) {}

  var timers = [];
  var reduceMotion = false;
  try { reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

  /* Test seam (not user-facing): the harness shortens the breath timers. */
  var timing = { inMs: BREATH_IN_MS, outMs: BREATH_OUT_MS };

  function clearTimers() { timers.forEach(function (t) { clearTimeout(t); }); timers = []; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function onPlatformScreen() { var s = $('screen-platform'); return !!(s && s.classList.contains('active')); }
  /* Soft press tick for in-screen controls. Buttons that also carry data-go
     already get the app's own tick from its handler — calling this there
     would double-buzz — so those wires skip it. */
  function tick() {
    try {
      var s = window.__ihtSound;
      if (s) { s.unlock(); s.tap(); }
    } catch (e) {}
  }

  /* The cue word, if the ready check saved one. Never invented: no saved
     word, no line. */
  function renderCue() {
    var line = $('platform-cue-line');
    if (!line) { return; }
    var cue = (read(CUE_KEY) || '').trim();
    if (cue) {
      line.textContent = 'Your word: \u201c' + cue.slice(0, 40) + '\u201d.';
      line.hidden = false;
    } else {
      line.hidden = true;
    }
  }

  /* ---------- the pad: one toggle, visible playing feedback ---------- */
  function renderSound(on, unavailable) {
    var btn = $('btn-platform-sound'), ind = $('platform-ind');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'Soft sound: on' : 'Soft sound';
    }
    if (ind) {
      ind.textContent = unavailable
        ? 'No sound on this phone \u2014 follow the words'
        : (on ? '\u266a Sound playing' : 'Sound off');
      ind.classList.toggle('playing', !!on);
    }
  }
  function syncSound() {
    var s = window.__ihtSound, on = false;
    try { on = !!(s && s.isAmbientPlaying && s.isAmbientPlaying()); } catch (e) { on = false; }
    renderSound(on, !s);
  }
  function toggleSound() {
    tick();
    var s = window.__ihtSound;
    if (!s) { renderSound(false, true); return; }
    var on = false;
    try {
      s.unlock();
      on = !!s.toggleAmbient();
    } catch (e) { on = false; }
    renderSound(on, false);
  }
  /* ---------- one slow breath, looping, eyes-optional ---------- */
  function breathCycle() {
    var cue = $('platform-breath-cue'), wrap = $('platform-pet-wrap');
    if (!cue) { return; }
    if (reduceMotion) {
      /* No auto-motion: the cue sits still and the rider leaves when ready. */
      cue.textContent = 'Breathe in\u2026 and out\u2026 nice and slow.';
      return;
    }
    if (wrap) { wrap.classList.remove('platform-out'); wrap.classList.add('platform-in'); }
    cue.textContent = 'Breathe in\u2026';
    later(function () {
      if (!onPlatformScreen()) { return; }
      cue.textContent = '\u2026and out\u2026';
      if (wrap) { wrap.classList.remove('platform-in'); wrap.classList.add('platform-out'); }
      later(function () {
        if (!onPlatformScreen()) { return; }
        if (wrap) { wrap.classList.remove('platform-out'); }
        breathCycle();
      }, timing.outMs);
    }, timing.inMs);
  }

  function openPlatform() {
    $all('.platform-petname').forEach(function (el) { el.textContent = petName; });
    var wrap = $('platform-pet-wrap');
    if (wrap) { wrap.classList.remove('platform-in', 'platform-out'); }
    renderCue();
    syncSound();
    clearTimers();
    breathCycle();
  }

  /* ---------- wiring ---------- */
  function wire(id, fn) {
    var el = $(id);
    if (el) { el.addEventListener('click', fn); }
  }
  wire('btn-platform-start', function () { openPlatform(); });
  wire('btn-platform-sound', function () { toggleSound(); });
  /* Board the train runs the same start-trip handler (route, stops, the
     ready-check trip line) — the platform minute sits between setup and
     boarding, it never starts a trip of its own. */
  wire('btn-platform-board', function () {
    /* No tick here: the start-trip handler ticks itself. */
    var start = $('btn-start-trip');
    if (start) { start.click(); }
  });

  /* Test seam: the harness reads state and shortens the breath timers. */
  window.__ihtPlatform = {
    open: openPlatform,
    playing: function () {
      try { var s = window.__ihtSound; return !!(s && s.isAmbientPlaying && s.isAmbientPlaying()); }
      catch (e) { return false; }
    },
    state: function () {
      var cue = $('platform-breath-cue');
      return { cue: cue ? cue.textContent : '', onScreen: onPlatformScreen() };
    },
    timing: timing
  };
})();
