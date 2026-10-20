/* I Hate Trains — guide.js (v27 "Talk me through it").
   An eyes-free, voice-led rescue: one tap on the panic screen starts a scripted linear
   rescue on screen-guide — near-black, the pet visibly breathing in sync, the phase
   word the only thing on screen. No menu, no reading, no decisions. The tap is the
   opt-in for the voice (the no-autoplay rule stays intact: voice auto-enables inside
   this mode only, never elsewhere). One full-width "I'm steadier" ends it at any
   moment. Same module-split pattern as crisis.js / stopheads.js: app.js calls
   window.__ihtGuide.stop() defensively whenever navigation leaves screen-guide.
   Everything degrades silently if the voice or pet bridge is missing. Fully offline:
   no audio files, no network. No storage keys. Zero jokes, sacred flow. */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  /* ---------- sequencing ---------- */
  var timers = [];
  function after(ms, fn) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function stop() {
    timers.forEach(function (t) { try { clearTimeout(t); } catch (e) {} });
    timers = [];
    try { if (window.__ihtVoice && window.__ihtVoice.stop) { window.__ihtVoice.stop(); } } catch (e) {}
  }
  function say(text) {
    try { if (window.__ihtVoice && window.__ihtVoice.speak) { window.__ihtVoice.speak(text); } } catch (e) {}
  }
  function word(text) { var el = $('guide-word'); if (el) { el.textContent = text; } }
  function sub(text) { var el = $('guide-sub'); if (el) { el.textContent = text || ''; } }
  function breathePet(grow, secs) {
    // The pet IS the breathing guide: visibly inhales and exhales in sync, same
    // easing the breathe screen uses, so eyes can rest on it without reading.
    var pb = $('guide-pet');
    if (pb) {
      pb.style.transition = 'transform ' + secs + 's cubic-bezier(.37,0,.63,1)';
      pb.style.transform = 'scale(' + (grow ? 1.35 : 1) + ')';
    }
  }

  /* The rescue script: acceptance line → 3 paced breaths → rapid 5-4-3-2-1
     grounding → close. hold = seconds to dwell before the next beat. */
  var SCRIPT = [
    { kind: 'line', word: 'You\u2019re okay.', say: 'You\u2019re doing okay. This will pass. Let\u2019s slow down together.', hold: 5 },
    { kind: 'breath', secs: 4 }, { kind: 'breath', secs: 4 }, { kind: 'breath', secs: 4 },
    { kind: 'line', word: 'five\u2026', say: 'Five things you can see. Look around, slowly.', hold: 7.5 },
    { kind: 'line', word: 'four\u2026', say: 'Four things you can touch. Your feet. The seat. Your hands.', hold: 7.5 },
    { kind: 'line', word: 'three\u2026', say: 'Three things you can hear. They can be quiet, or ordinary.', hold: 7.5 },
    { kind: 'line', word: 'two\u2026', say: 'Two things you can smell.', hold: 6.5 },
    { kind: 'line', word: 'one\u2026', say: 'One thing you can taste.', hold: 6.5 },
    { kind: 'line', word: 'You did well.', say: 'You did well. I\u2019m right here.', hold: 5, last: true }
  ];

  function runStep(i) {
    var s = SCRIPT[i];
    if (!s) { return; }
    if (s.kind === 'breath') {
      word('breathe in\u2026'); sub(''); say('breathe in\u2026'); breathePet(true, s.secs);
      after(s.secs * 1000, function () {
        word('and out\u2026'); say('and out\u2026'); breathePet(false, s.secs);
        after(s.secs * 1000, function () { runStep(i + 1); });
      });
      return;
    }
    word(s.word); sub(s.sub || ''); if (s.say) { say(s.say); }
    after(s.hold * 1000, function () {
      if (s.last) { breathePet(false, 2); return; } // the pet settles; the screen waits for "I'm steadier"
      runStep(i + 1);
    });
  }

  function start() {
    stop();
    try { if (window.__ihtGuidePet) { window.__ihtGuidePet.mount($('guide-pet')); } } catch (e) {}
    var pb = $('guide-pet');
    if (pb) { pb.style.transition = 'none'; pb.style.transform = 'scale(1)'; }
    word('\u2026'); sub('');
    try { if (window.__ihtUpdate && window.__ihtUpdate.go) { window.__ihtUpdate.go('screen-guide'); } } catch (e) {}
    runStep(0);
  }

  /* ---------- wiring ---------- */
  var launch = $('btn-panic-guide');
  if (launch) { launch.addEventListener('click', function () { start(); }); }
  var end = $('btn-guide-end');
  if (end) {
    end.addEventListener('click', function () {
      stop();
      try { if (window.__ihtUpdate && window.__ihtUpdate.go) { window.__ihtUpdate.go('screen-panic'); } } catch (e) {}
    });
  }

  window.__ihtGuide = { start: start, stop: stop };
})();
