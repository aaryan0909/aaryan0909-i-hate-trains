/* I Hate Trains — clock.js (v60 "The ten-minute clock").
   A quiet ring on the guided rescue (screen-guide) that fills as the wave
   passes its ~10-minute peak, then one calm line: "Past the peak now — the
   wave is passing." No numbers, no countdown, nothing to watch or decide.
   The ring measures from when the panic screen opened: the anchor is captured
   on panic entry from the existing iht_resume_wave record calm42 already keeps
   (no new storage keys), so a rider who breathed a few minutes before starting
   the guide still counts those minutes. Re-entering the guide in the same wave
   keeps the in-memory anchor, so the ring resumes from where it left off;
   reopening the app within the hour and resuming the wave restores it from
   the record; the wave ends at re-entry/arrival or when the resume card is
   dismissed, and a fresh panic after that starts a fresh ring. Fully offline,
   no voice, no sound. Same module-split pattern as guide.js / calm42.js:
   app.js is never touched. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function readJSON(k, fb) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }

  var PEAK_MS = 10 * 60 * 1000; // panic peaks within about 10 minutes (DSM-5)
  var HOUR = 60 * 60 * 1000;    // same wave window as the resume card
  var CIRC = 163.36;            // 2 * pi * 26, the ring's r=26 circle
  var TICK_MS = 5000;
  var CLEAR_ON = { 'screen-reentry': 1, 'screen-arrived': 1 };

  var anchor = null; // ms epoch the current wave started, in-memory only
  var timer = null;

  function fillEl() { return $('wave-clock-fill'); }
  function lineEl() { return $('wave-clock-line'); }

  function resolveAnchor() {
    var now = Date.now();
    if (anchor && now - anchor < HOUR) { return anchor; }
    // The resume record is the panic tool's start: the guide entry, or the
    // tool before it. Either way it is minutes after the panic screen opened.
    var r = readJSON('iht_resume_wave', null);
    if (r && r.savedAt && now - r.savedAt < HOUR) { anchor = r.savedAt; return anchor; }
    anchor = now;
    return anchor;
  }
  function clearAnchor() { anchor = null; }
  // The wave starts at the panic screen: capture the anchor there, before
  // calm42 rewrites the resume record on guide entry. Without this the ring
  // would restart for a rider who breathed a few minutes before starting
  // the guide. An anchor already set in this wave is kept.
  function captureAtPanic() {
    var now = Date.now();
    if (anchor && now - anchor < HOUR) { return; }
    var r = readJSON('iht_resume_wave', null);
    anchor = (r && r.savedAt && now - r.savedAt < HOUR) ? r.savedAt : now;
  }

  function render() {
    var fill = fillEl(), line = lineEl();
    if (!fill) { return; }
    var a = resolveAnchor();
    var elapsed = Math.max(0, Date.now() - a);
    var frac = Math.min(elapsed / PEAK_MS, 1);
    fill.style.strokeDashoffset = String(CIRC * (1 - frac));
    var past = elapsed >= PEAK_MS;
    fill.classList.toggle('past-peak', past);
    if (line) { line.hidden = !past; }
  }
  function tick() { render(); }
  function start() {
    stop();
    resolveAnchor();
    render();
    timer = setInterval(render, TICK_MS);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  function onScreenChange() {
    var a = document.querySelector('.screen.active');
    if (!a) { return; }
    if (CLEAR_ON[a.id]) { stop(); clearAnchor(); return; }
    if (a.id === 'screen-panic') { captureAtPanic(); stop(); return; }
    if (a.id === 'screen-guide') { start(); return; }
    stop();
  }

  try {
    var mo = new MutationObserver(function () { onScreenChange(); });
    $all('.screen').forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['class'] }); });
  } catch (e) { /* observer unavailable: the ring still renders via tick */ }

  // "Not now" on the resume card ends the wave: a fresh panic later starts
  // a fresh ring instead of resuming the dismissed one.
  var dc = $('resume-wave-dismiss');
  if (dc) { dc.addEventListener('click', function () { stop(); clearAnchor(); }); }

  // Already on the guide when this module loads (deep link): start the ring.
  try { onScreenChange(); } catch (e) {}

  window.__ihtClock = {
    PEAK_MS: PEAK_MS,
    tick: tick,
    start: start,
    stop: stop,
    anchor: function () { return anchor; },
    state: function () {
      var a = anchor;
      return { anchor: a, elapsedMs: a ? Math.max(0, Date.now() - a) : null, pastPeak: a ? (Date.now() - a) >= PEAK_MS : false };
    },
    reset: function () { stop(); clearAnchor(); }
  };
})();
