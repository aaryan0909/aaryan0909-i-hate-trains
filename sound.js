/* I Hate Trains — sound.js (v35: the sound pack, rebuilt).
 *
 * Replaces the old speech-output system and the old trip hum. The pet no
 * longer talks: it guides with on-screen text and speech bubbles only.
 * Everything here is sound, synthesized live with Web Audio. Zero files,
 * zero dependencies, zero network: fully offline by construction.
 *
 * THE OLD HUM BUG, AND WHY THIS IS DIFFERENT
 * The old trip hum was a single brown-noise bed played quietly through a
 * low filter, with only a label flip as feedback. On a phone speaker that
 * reads as silence: tiny speakers barely reproduce low noise, and a label
 * flip is not proof of sound. The new ambient is a pitched pad (audible
 * fundamentals a phone speaker can actually reproduce) through a wide
 * filter, at a real level, plus a VISIBLE pulsing playing indicator on
 * the sound button. Every sound control in the app must produce audible
 * output PLUS visible playing feedback, every time. If either is missing,
 * that control is broken, not "subtle".
 *
 * PENTATONIC ONLY. Every pitched cue uses only C / D / E / G / A (any
 * octave). No semitone clashes, no harsh intervals, nothing startling.
 * Oscillators are sine or triangle only. Breath cues use slow attacks:
 * nothing here beeps, buzzes, or blares.
 *
 * iOS RELIABILITY (read before "fixing" this file)
 * - The AudioContext is created ONLY inside a user tap (unlock(), called
 *   from sound-control taps and from startBreathe). It is never created
 *   at load, on a timer, or on navigation.
 * - Listeners below only RESUME an existing context when the app returns
 *   to the foreground (visibilitychange / pageshow / focus). They never
 *   create one. They cover the `interrupted` state iOS Safari uses when
 *   a call, Siri, or another app takes audio: on return, resume() is
 *   called again, and if the context still is not running, the next tap
 *   retries via unlock(). Sound requested while the context is not
 *   running is dropped silently, never queued: a late cue is worse
 *   than a missed one in a panic-adjacent flow.
 * - SILENT SWITCH (honest behavior, not a bug to work around): on
 *   iPhone, Web Audio played through the built-in speaker is muted by
 *   iOS when the silent switch is ON. No web app can override that.
 *   The engine still runs and the playing indicator still pulses, but
 *   nothing is audible from the speaker until the switch is flipped
 *   off. Headphones and Bluetooth audio are NOT muted by the switch.
 *   Never claim sound is audible when the switch is on; the indicator
 *   shows engine state, and the Privacy screen says this in plain words.
 *
 * MODE MATRIX (prefs.breathSound in app.js stays the source of truth;
 * app.js calls setMode() whenever it changes, and gates call sites):
 * - chimes:  breath swells, motif, completion, arrival, stop alert, tap.
 * - ambient: ambient pad only (breath phases stay visual + haptic).
 * - both:    chimes + ambient.
 * - off:     nothing. Primitives below do NOT gate on mode themselves;
 *   they play when called, so a caller bug is audible in testing
 *   instead of silently swallowed. Gating lives at the call sites.
 *
 * API: window.__ihtSound = { version, unlock, resumeOnReturn, state,
 *   setMode, getMode, motif, breath, completion, arrival, tap,
 *   stopAlert, ambientStart, ambientStop, toggleAmbient,
 *   isAmbientPlaying, stopAll, syncIndicator, + constants below }.
 * Vanilla JS, no dependencies, no build step.
 */
(function () {
  'use strict';

  /* C D E G A, every octave the pack uses. Every pitched frequency in
     this file must be a member of this list (the LFO rate and the two
     filter cutoffs are not pitches and are listed separately). */
  var PENTA = [
    130.81, 146.83, 164.81, 196.00, 220.00,               /* C3 D3 E3 G3 A3 */
    261.63, 293.66, 329.63, 392.00, 440.00,               /* C4 D4 E4 G4 A4 */
    523.25, 587.33, 659.25, 783.99, 880.00, 1046.50       /* C5 D5 E5 G5 A5 C6 */
  ];
  var AMBIENT_MASTER_PEAK = 0.22;   /* clearly audible; old hum ran at 0.10 */
  var AMBIENT_FILTER_HZ = 1200;     /* wide: harmonics survive phone speakers */
  var AMBIENT_NOISE_GAIN = 0.05;    /* texture only, never the main signal */
  var AMBIENT_FADE_IN_SECS = 2.5;
  var AMBIENT_FADE_OUT_SECS = 1.2;
  var BREATH_IN_SECS = 4;
  var BREATH_OUT_SECS = 6;
  var MOTIF_NOTES = [523.25, 659.25, 783.99, 659.25]; /* C5 E5 G5 E5: kept from v31 */
  var SILENT_SWITCH_NOTE = 'On iPhone, the silent switch mutes speaker sound: ' +
    'flip it off or use headphones to hear it. The playing indicator ' +
    'shows the sound engine is running even when the switch mutes it.';

  var ctx = null, master = null, comp = null;
  var mode = 'chimes';
  var ambient = null; /* { padBus, filt, nodes } or null */
  var active = [];    /* { node, gain } one-shots, for stopAll() */

  function state() {
    if (!ctx) { return 'none'; }
    try { return ctx.state || 'unknown'; } catch (e) { return 'unknown'; }
  }

  /* Create (only when asked, i.e. inside a tap) and/or resume the
     context. Returns the context, or null when audio is unavailable. */
  function unlock() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { return null; }
        ctx = new AC();
        comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 4;
        try { comp.connect(ctx.destination); } catch (e) {}
        master = ctx.createGain();
        master.gain.value = 0.9;
        try { master.connect(comp); } catch (e) {}
      }
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
        try { ctx.resume(); } catch (e) {}
      }
      if (ctx.state === 'closed') { ctx = null; master = null; comp = null; }
    } catch (e) { return null; }
    return ctx;
  }

  /* Foreground return: resume an EXISTING context, including the
     `interrupted` state. Never creates a context. Returns true when
     the context is running afterwards, false otherwise (the next tap
     retries through unlock()). */
  function resumeOnReturn() {
    if (!ctx) { return false; }
    try {
      if (ctx.state === 'closed') { ctx = null; master = null; comp = null; return false; }
      if (ctx.state === 'running') { return true; }
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') { ctx.resume(); }
      return ctx.state === 'running';
    } catch (e) { return false; }
  }
  try {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        try { if (!document.hidden) { resumeOnReturn(); } } catch (e) {}
      });
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pageshow', function () { resumeOnReturn(); });
      window.addEventListener('focus', function () { resumeOnReturn(); });
    }
  } catch (e) {}

  function track(node, gain) {
    active.push({ node: node, gain: gain });
    try {
      node.onended = function () {
        for (var i = 0; i < active.length; i++) {
          if (active[i].node === node) { active.splice(i, 1); break; }
        }
      };
    } catch (e) {}
  }

  /* One soft tone: slow attack by default. `peak` is the gain peak,
     `attack` the ramp-up, `dur` the hold before release. */
  function tone(freq, delay, dur, peak, attack, type) {
    if (!ctx || !master) { return false; }
    try {
      var t = ctx.currentTime + delay;
      var o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.setValueAtTime(peak, t + attack + dur);
      g.gain.linearRampToValueAtTime(0.0001, t + attack + dur + 0.4);
      o.connect(g);
      try { g.connect(master); } catch (e) {}
      o.start(t);
      o.stop(t + attack + dur + 0.5);
      track(o, g);
      return true;
    } catch (e) { return false; }
  }

  /* A breath-shaped swell: gain rises for the whole in-breath, falls
     for the whole out-breath. Two stacked pentatonic tones (sine +
     a quiet triangle twin) so the swell feels warm, never thin. */
  function swell(freqs, secs, rising, peak) {
    if (!ctx || !master) { return false; }
    var ok = false;
    try {
      var t = ctx.currentTime;
      freqs.forEach(function (f) {
        var o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        var o2 = ctx.createOscillator();
        o2.type = 'triangle'; o2.frequency.value = f;
        var g = ctx.createGain();
        var g2 = ctx.createGain(); g2.gain.value = 0.35;
        if (rising) {
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(peak, t + secs);
          g.gain.linearRampToValueAtTime(0.0001, t + secs + 0.4);
        } else {
          g.gain.setValueAtTime(peak, t);
          g.gain.linearRampToValueAtTime(0.0001, t + secs);
        }
        o.connect(g); o2.connect(g2); g2.connect(g);
        try { g.connect(master); } catch (e) {}
        o.start(t); o2.start(t);
        o.stop(t + secs + 0.5); o2.stop(t + secs + 0.5);
        track(o, g); track(o2, g2);
        ok = true;
      });
    } catch (e) { return false; }
    return ok;
  }

  /* Start motif: the v31 original, same pitches and rhythm, kept
     deliberately. Slightly louder than the v31 original (peak 0.10
     vs 0.05) so it survives a phone speaker, same warm low pad. */
  function motif() {
    if (!unlock()) { return false; }
    var any = false;
    MOTIF_NOTES.forEach(function (f, i) {
      if (tone(f, 0.05 + i * 0.32, 0.5, 0.10, 0.12, 'sine')) { any = true; }
    });
    tone(261.63, 0.05, 1.6, 0.03, 0.3, 'triangle');
    return any;
  }

  /* Breath cues, shaped like breathing. 'in' rises for 4s, 'out'
     falls for 6s, 'hold'/'rest' is one short soft swell. Callers
     gate on prefs.breathSound (chimes|both); see header matrix. */
  function breath(kind) {
    if (!ctx) { return false; }
    if (kind === 'in') { return swell([523.25, 783.99], BREATH_IN_SECS, true, 0.14); }
    if (kind === 'out') { return swell([783.99, 659.25], BREATH_OUT_SECS, false, 0.13); }
    return swell([659.25], 1.2, true, 0.06);
  }

  /* Completion: a gentle 4-note pentatonic rise, slow attacks. */
  function completion() {
    if (!ctx) { return false; }
    var notes = [523.25, 659.25, 783.99, 1046.50];
    var any = false;
    notes.forEach(function (f, i) {
      if (tone(f, i * 0.28, 0.9, 0.12, 0.15, 'sine')) { any = true; }
    });
    return any;
  }

  /* Arrival / celebration: a different rise from completion (wider
     intervals, brighter top), so the two are never confused. */
  function arrival() {
    if (!ctx) { return false; }
    var notes = [523.25, 783.99, 880.00, 1046.50];
    var any = false;
    notes.forEach(function (f, i) {
      if (tone(f, i * 0.30, 0.9, 0.13, 0.15, 'sine')) { any = true; }
    });
    tone(261.63, 0, 2.5, 0.03, 0.4, 'triangle');
    return any;
  }

  /* Soft tap: calm-time UI confirmation only. Never wired to panic,
     breathe, guide, or crisis screens. Fast attack is deliberate
     here (a tap must answer instantly); breath cues keep slow
     attacks. Sine only, one short note. */
  function tap() {
    if (!ctx) { return false; }
    return tone(659.25, 0, 0.18, 0.10, 0.01, 'sine');
  }

  /* Gentle stop alert: two soft notes, slow attack, ~1.6s. Deliberately
     shorter and lower than completion/arrival so a stop heads-up never
     sounds like a celebration. */
  function stopAlert() {
    if (!ctx) { return false; }
    var a = tone(659.25, 0, 0.6, 0.11, 0.25, 'sine');
    var b = tone(783.99, 0.55, 0.6, 0.11, 0.25, 'sine');
    return a || b;
  }

  function brownNoiseBuffer(c) {
    var len = c.sampleRate * 3;
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    return buf;
  }

  /* Ambient: pitched pad first (audible on a phone speaker), noise
     only as a quiet bed underneath. Wide filter, real level, slow
     fade-in so it never startles, pulsing indicator while playing. */
  function ambientStart() {
    if (!unlock()) { return false; }
    ambientStop();
    try {
      var t = ctx.currentTime;
      var padBus = ctx.createGain();
      padBus.gain.setValueAtTime(0.0001, t);
      padBus.gain.linearRampToValueAtTime(AMBIENT_MASTER_PEAK, t + AMBIENT_FADE_IN_SECS);
      var filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = AMBIENT_FILTER_HZ; filt.Q.value = 0.5;
      filt.connect(padBus);
      try { padBus.connect(master); } catch (e) {}
      var nodes = [];
      /* C3 G3 A3 E4: warm pentatonic stack, slow detune shimmer. */
      [130.81, 196.00, 220.00, 329.63].forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        o.detune.value = (i % 2 === 0 ? -5 : 5);
        var g = ctx.createGain(); g.gain.value = 0.20;
        o.connect(g); g.connect(filt); o.start(t); nodes.push(o);
      });
      var lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.07; /* slow evolution, not a pitch */
      var lfoG = ctx.createGain(); lfoG.gain.value = 250;
      lfo.connect(lfoG); lfoG.connect(filt.frequency); lfo.start(t); nodes.push(lfo);
      var src = ctx.createBufferSource();
      src.buffer = brownNoiseBuffer(ctx); src.loop = true;
      var nFilt = ctx.createBiquadFilter();
      nFilt.type = 'lowpass'; nFilt.frequency.value = 900;
      var nGain = ctx.createGain(); nGain.gain.value = AMBIENT_NOISE_GAIN;
      src.connect(nFilt); nFilt.connect(nGain);
      try { nGain.connect(master); } catch (e) {}
      src.start(t); nodes.push(src);
      ambient = { padBus: padBus, filt: filt, nodes: nodes };
      syncIndicator();
      return true;
    } catch (e) { ambient = null; return false; }
  }

  function ambientStop() {
    var a = ambient; ambient = null;
    if (!a) { syncIndicator(); return; }
    try {
      var t = ctx.currentTime;
      a.padBus.gain.cancelScheduledValues(t);
      a.padBus.gain.setValueAtTime(Math.max(a.padBus.gain.value, 0.0001), t);
      a.padBus.gain.linearRampToValueAtTime(0.0001, t + AMBIENT_FADE_OUT_SECS);
      var nodes = a.nodes;
      setTimeout(function () {
        nodes.forEach(function (n) { try { n.stop(); } catch (e) {} });
      }, (AMBIENT_FADE_OUT_SECS + 0.3) * 1000);
    } catch (e) {}
    syncIndicator();
  }

  function isAmbientPlaying() { return !!ambient; }

  function toggleAmbient() {
    if (ambient) { ambientStop(); return false; }
    return ambientStart();
  }

  /* Visible playing feedback: the pulsing dot + label + pressed state
     on the trip sound button. Called on every ambient change. If the
     button is absent (older markup), this is a harmless no-op. */
  function syncIndicator() {
    try {
      var dot = document.getElementById('sound-indicator');
      var btn = document.getElementById('tool-sound');
      var label = document.getElementById('sound-label');
      var on = !!ambient;
      if (dot && dot.classList) { dot.classList.toggle('playing', on); }
      if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
      if (label) { label.textContent = on ? 'Ambient playing' : 'Ambient off'; }
    } catch (e) {}
  }

  /* Stop everything: ambient fade + one-shot gains to silence fast.
     Never leaves a tone droning after navigation. */
  function stopAll() {
    ambientStop();
    try {
      var t = ctx ? ctx.currentTime : 0;
      active.slice().forEach(function (a) {
        try {
          a.gain.gain.cancelScheduledValues(t);
          a.gain.gain.setValueAtTime(Math.max(a.gain.gain.value, 0.0001), t);
          a.gain.gain.linearRampToValueAtTime(0.0001, t + 0.3);
          setTimeout(function () { try { a.node.stop(); } catch (e) {} }, 350);
        } catch (e) {}
      });
      active = [];
    } catch (e) {}
  }

  function setMode(m) {
    if (m === 'chimes' || m === 'ambient' || m === 'both' || m === 'off') { mode = m; }
  }
  function getMode() { return mode; }

  window.__ihtSound = {
    version: '35.0.0',
    unlock: unlock,
    resumeOnReturn: resumeOnReturn,
    state: state,
    setMode: setMode,
    getMode: getMode,
    motif: motif,
    breath: breath,
    completion: completion,
    arrival: arrival,
    tap: tap,
    stopAlert: stopAlert,
    ambientStart: ambientStart,
    ambientStop: ambientStop,
    toggleAmbient: toggleAmbient,
    isAmbientPlaying: isAmbientPlaying,
    stopAll: stopAll,
    syncIndicator: syncIndicator,
    PENTA_FREQS: PENTA,
    MOTIF_NOTES: MOTIF_NOTES,
    AMBIENT_MASTER_PEAK: AMBIENT_MASTER_PEAK,
    AMBIENT_FILTER_HZ: AMBIENT_FILTER_HZ,
    AMBIENT_NOISE_GAIN: AMBIENT_NOISE_GAIN,
    AMBIENT_FADE_IN_SECS: AMBIENT_FADE_IN_SECS,
    BREATH_IN_SECS: BREATH_IN_SECS,
    BREATH_OUT_SECS: BREATH_OUT_SECS,
    SILENT_SWITCH_NOTE: SILENT_SWITCH_NOTE
  };
})();
