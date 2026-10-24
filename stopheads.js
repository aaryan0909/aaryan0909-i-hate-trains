/* "Your stop, out loud" (v26) — opt-in spoken stop heads-up during trips.
 *
 * Companion module to app.js, loaded after it. app.js exposes one surface:
 *   window.__ihtVoice = { speak, warm, stop, prefs, savePrefs }
 * the v22/v23 iOS-hardened pet voice (human-voice picker, rate 0.75 / pitch 0.9,
 * in-gesture warm, never cancel()+speak() in the same tick) plus the live prefs
 * object — so this module mutates the SAME prefs app.js saves, never a copy.
 * app.js calls window.__ihtStopHeadsUp(trip.left) defensively from advanceStop(),
 * the ONE stop counter, so manual taps and TriMap auto-advance both pass
 * through it. (Same split pattern as crisis.js.)
 *
 * Calm-time trip setup only, off by default, fully offline. Two calm lines,
 * zero jokes — 2 stops out: "Two stops to go. You're doing great." / 1 stop
 * out: "Next stop is yours. Take a breath." Never in the panic flow.
 */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function app() { return window.__ihtVoice || null; }
  function prefs() {
    var a = app();
    if (a && a.prefs) { return a.prefs; }
    try { return JSON.parse(localStorage.getItem('iht_prefs')) || {}; } // app.js absent: local fallback
    catch (e) { return {}; }
  }
  function save() {
    var a = app();
    if (a && a.savePrefs) { try { a.savePrefs(); } catch (e) {} return; }
    try { localStorage.setItem('iht_prefs', JSON.stringify(prefs())); } catch (e) {}
  }
  function render() {
    var b = $('set-stopheads');
    if (b) {
      var on = !!prefs().stopHeadsUp;
      b.classList.toggle('done', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    var q = $('set-stopheads-quiet');
    if (q) {
      var qon = !!prefs().stopHeadsQuiet;
      q.classList.toggle('done', qon);
      q.setAttribute('aria-pressed', qon ? 'true' : 'false');
    }
  }
  function tick() { try { if (navigator.vibrate) { navigator.vibrate(12); } } catch (e) {} }

  var b = $('set-stopheads');
  if (b) {
    b.addEventListener('click', function () {
      var p = prefs();
      p.stopHeadsUp = !p.stopHeadsUp;
      save(); render(); tick();
      var a = app();
      // Flipping ON warms the engine inside the gesture: instant "Voice on."
      // proof it works, and the gesture unlocks iOS speech (the v22 pattern).
      if (a) { if (p.stopHeadsUp) { a.warm(); } else { a.stop(); } }
    });
  }
  var qb = $('set-stopheads-quiet');
  if (qb) {
    qb.addEventListener('click', function () {
      var p = prefs();
      p.stopHeadsQuiet = !p.stopHeadsQuiet;
      save(); render(); tick();
    });
  }
  render();

  window.__ihtStopHeadsUp = function (left) {
    var a = app();
    if (!prefs().stopHeadsUp || !a) { return; } // never without the opt-in
    /* v31 audit: quiet mode is first-class, not a buried toggle. Pet pulse plus
       screen flash, no public voice — embarrassment is a real barrier on a
       crowded train. */
    if (prefs().stopHeadsQuiet) {
      try { if (navigator.vibrate) { navigator.vibrate([60, 80, 60]); } } catch (e) {}
      try {
        document.body.classList.add('stopflash');
        setTimeout(function () { document.body.classList.remove('stopflash'); }, 900);
      } catch (e) {}
      return;
    }
    if (left === 2) { a.speak('Two stops to go. You\u2019re doing great.'); }
    else if (left === 1) { a.speak('Next stop is yours. Take a breath.'); }
  };
})();
