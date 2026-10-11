/* drift.js — "Drift": an original generative calming score for I Hate Trains.
 *
 * A composed 8-minute piece rendered live with the Web Audio API. Zero audio
 * files, zero network, fully offline. Written in the spirit of the research
 * behind Marconi Union's "Weightless" (slow harmonic rhythm, no repeating
 * melody, gradual deceleration, narrow dynamics) — original notes throughout.
 *
 * Design:
 *  - Key of D major; a slow I-vi-IV-V loop (Dmaj9 → Bm9 → Gmaj9 → Amaj9),
 *    one chord every 30 seconds. Warm ninths, no harsh resolutions.
 *  - Three layers: sub-bass root drones (very quiet), a soft sine pad stack
 *    through a slow-breathing lowpass filter, and sparse triangle plucks from
 *    a seeded melodic walk (few notes, lots of space, no leaps that startle).
 *  - One continuous "exhale": an ultra-subtle swell eases the felt pulse
 *    from ~55 bpm to ~45 bpm across the piece. Felt, not heard.
 *  - Deterministic (fixed seed): the piece is identical every loop, so the
 *    8-minute loop is seamless. Mastered quiet with a gentle compressor.
 *  - Four felt phases: Arrival (0–1:30, drone + pad), Drifting (1:30–5:00,
 *    full texture), Deepening (5:00–7:00, sparser, darker), Dissolve
 *    (7:00–8:00, thins back to the opening) → loops.
 *
 * API: window.Drift = { version, start(ctx), stop(), isPlaying() }
 *  - start(ctx): ctx is an existing AudioContext (created on a user gesture
 *    by the app — Drift never creates one, so it is iOS-safe). Fades in
 *    over 8 seconds; never startling. Idempotent: starting twice restarts cleanly.
 *  - stop(): 2-second fade-out, then every node is stopped and disconnected.
 *    Safe to call when not playing.
 *  - _tick() / _debug(): internals exposed for automated testing only.
 *
 * Vanilla JS, no dependencies, no build step.
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var LOOP_SECS = 480;   // 8-minute seamless loop
  var CHORD_SECS = 30;   // slow harmonic rhythm: one chord per 30s
  var SEED = 20261010;   // fixed seed — the piece is composed, not random

  /* D-major warmth. Literal frequencies (A4 = 440, equal temperament). */
  var CHORDS = [
    { drone: 73.42, pad: [146.83, 185.00, 220.00, 277.18, 329.63] }, // Dmaj9
    { drone: 61.74, pad: [123.47, 146.83, 185.00, 220.00, 277.18] }, // Bm9
    { drone: 49.00, pad: [ 98.00, 123.47, 146.83, 185.00, 220.00] }, // Gmaj9
    { drone: 55.00, pad: [110.00, 138.59, 164.81, 207.65, 246.94] }  // Amaj9
  ];
  /* Sweet, non-piercing register for the pluck melody: D E F# A B C#. */
  var SCALE = [293.66, 329.63, 369.99, 440.00, 493.88, 554.37];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Build the full loop's event list once per start(). Deterministic. */
  function buildEvents() {
    var rnd = mulberry32(SEED);
    var evs = [];
    var slots = LOOP_SECS / CHORD_SECS, i;
    for (i = 0; i < slots; i++) {
      evs.push({ t: i * CHORD_SECS, type: 'chord', chord: CHORDS[i % CHORDS.length] });
    }
    /* Sparse pluck melody: a seeded walk — mostly steps, occasional thirds,
       repetition allowed (stillness calms), never a leap that startles. */
    var idx = 0, t = 48, r;
    while (t < 448) {
      r = rnd();
      if (r < 0.55) { idx += (rnd() < 0.5 ? -1 : 1); }
      else if (r < 0.78) { idx += (rnd() < 0.5 ? -2 : 2); }
      else if (r < 0.90) { /* repeat the note: rest, not motion */ }
      else { t += 6 + rnd() * 6; continue; } // a longer rest
      if (idx < 0) { idx = 1; }
      if (idx > SCALE.length - 1) { idx = SCALE.length - 2; }
      evs.push({ t: t, type: 'pluck', freq: SCALE[idx], vel: 0.055 + rnd() * 0.03 });
      t += (t < 300 ? (7 + rnd() * 7) : (11 + rnd() * 7)); // deepening: more space late
    }
    evs.sort(function (a, b) { return a.t - b.t; });
    return evs;
  }

  var S = null; // live session state, or null when idle

  function scheduleChord(ch, at) {
    var ctx = S.ctx, i, o, g, peak;
    /* Sub-bass root + a faint octave shimmer: felt more than heard. */
    var drones = [[ch.drone, 0.05], [ch.drone * 2, 0.012]];
    for (i = 0; i < drones.length; i++) {
      peak = drones[i][1];
      o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = drones[i][0];
      g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak, at + 8);
      g.gain.setValueAtTime(peak, at + CHORD_SECS);
      g.gain.exponentialRampToValueAtTime(0.0001, at + CHORD_SECS + 8);
      o.connect(g); g.connect(S.droneBus);
      o.start(at); o.stop(at + CHORD_SECS + 8.2);
      S.nodes.push({ node: o, end: at + CHORD_SECS + 8.2 });
    }
    /* Pad: five warm voices with a 10-second crossfade into the next chord. */
    for (i = 0; i < ch.pad.length; i++) {
      o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = ch.pad[i];
      o.detune.value = (i % 2 === 0 ? -4 : 4); // a breath of detune = warmth
      g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.045, at + 10);
      g.gain.setValueAtTime(0.045, at + CHORD_SECS);
      g.gain.exponentialRampToValueAtTime(0.0001, at + CHORD_SECS + 10);
      o.connect(g); g.connect(S.padBus);
      o.start(at); o.stop(at + CHORD_SECS + 10.2);
      S.nodes.push({ node: o, end: at + CHORD_SECS + 10.2 });
    }
  }

  function schedulePluck(ev, at) {
    var ctx = S.ctx, f = ev.freq;
    if (!isFinite(f) || f <= 0) { return; }
    var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(ev.vel, at + 0.4); // gentle attack: nothing pings
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3.2);
    o.connect(g); g.connect(S.pluckBus);
    o.start(at); o.stop(at + 3.4);
    S.nodes.push({ node: o, end: at + 3.4 });
  }

  function schedule(ev, at) {
    if (ev.type === 'chord') { scheduleChord(ev.chord, at); }
    else { schedulePluck(ev, at); }
  }

  /* Lookahead scheduler: runs once a second, schedules ~6s ahead so timing
     stays smooth even if the timer jitters. */
  function tick() {
    if (!S) { return; }
    try {
      var ctx = S.ctx, horizon = ctx.currentTime + 6, guard = 0;
      var loopEnd = S.loopStart + (S.loops + 1) * LOOP_SECS;
      if (ctx.currentTime > loopEnd + 30) { // timer stalled badly: resync
        S.loops = Math.floor((ctx.currentTime - S.loopStart) / LOOP_SECS);
        S.idx = 0;
      }
      while (guard++ < 400) {
        if (S.idx >= S.events.length) { S.idx = 0; S.loops++; } // seamless loop
        var ev = S.events[S.idx];
        var at = S.loopStart + S.loops * LOOP_SECS + ev.t;
        if (at > horizon) { break; }
        if (at >= ctx.currentTime - 2) { schedule(ev, Math.max(at, ctx.currentTime + 0.05)); }
        S.idx++;
      }
      /* Prune finished nodes so the list stays bounded on long rides. */
      var now = ctx.currentTime;
      S.nodes = S.nodes.filter(function (n) { return n.end > now; });
    } catch (e) { /* a scheduler hiccup must never break the app */ }
  }

  function start(ctx) {
    if (!ctx) { return false; }
    stop(); // idempotent: a second start restarts cleanly
    try {
      var t0 = ctx.currentTime + 0.15;

      var master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.16, t0 + 8); // slow fade-in: never startling
      var comp = ctx.createDynamicsCompressor(); // gentle glue: narrow dynamic range
      comp.threshold.value = -28; comp.knee.value = 20; comp.ratio.value = 5;
      comp.attack.value = 0.05; comp.release.value = 0.4;
      master.connect(comp); comp.connect(ctx.destination);

      /* The long exhale: one swell across the whole mix, felt pulse easing 55 → 45 bpm. */
      var swell = ctx.createGain(); swell.gain.value = 1.0;
      swell.connect(master);
      var swellLfo = ctx.createOscillator(); swellLfo.type = 'sine';
      swellLfo.frequency.setValueAtTime(55 / 60, t0);
      swellLfo.frequency.linearRampToValueAtTime(45 / 60, t0 + LOOP_SECS);
      var swellDepth = ctx.createGain(); swellDepth.gain.value = 0.055; // felt, not heard
      swellLfo.connect(swellDepth); swellDepth.connect(swell.gain);
      swellLfo.start(t0);

      /* Pad bus: warm lowpass with a slow-breathing cutoff. */
      var padBus = ctx.createGain();
      var padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass'; padFilter.frequency.value = 700; padFilter.Q.value = 0.4;
      padBus.connect(padFilter); padFilter.connect(swell);
      var padLfo = ctx.createOscillator(); padLfo.type = 'sine'; padLfo.frequency.value = 0.05;
      var padLfoDepth = ctx.createGain(); padLfoDepth.gain.value = 120;
      padLfo.connect(padLfoDepth); padLfoDepth.connect(padFilter.frequency);
      padLfo.start(t0);

      /* Pluck bus: gentle top end plus a breath of space (subtle feedback delay). */
      var pluckBus = ctx.createGain();
      var pluckFilter = ctx.createBiquadFilter();
      pluckFilter.type = 'lowpass'; pluckFilter.frequency.value = 1700; pluckFilter.Q.value = 0.3;
      pluckBus.connect(pluckFilter); pluckFilter.connect(swell);
      var delay = ctx.createDelay(1.0); delay.delayTime.value = 0.42;
      var fb = ctx.createGain(); fb.gain.value = 0.28;
      var wet = ctx.createGain(); wet.gain.value = 0.14;
      pluckFilter.connect(delay); delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(swell);

      /* Drone bus: sub-bass roots, very quiet. */
      var droneBus = ctx.createGain(); droneBus.connect(swell);

      S = {
        ctx: ctx, t0: t0, master: master,
        events: buildEvents(), idx: 0, loops: 0, loopStart: t0,
        padBus: padBus, pluckBus: pluckBus, droneBus: droneBus,
        nodes: [
          { node: swellLfo, end: Infinity },
          { node: padLfo, end: Infinity }
        ],
        timer: null
      };
      S.timer = setInterval(tick, 1000);
      tick();
      return true;
    } catch (e) { stop(); return false; }
  }

  function stop() {
    var s = S; S = null;
    if (!s) { return; }
    try {
      if (s.timer) { clearInterval(s.timer); }
      var ctx = s.ctx, t = ctx.currentTime;
      s.master.gain.cancelScheduledValues(t);
      s.master.gain.setValueAtTime(Math.max(s.master.gain.value, 0.0001), t);
      s.master.gain.exponentialRampToValueAtTime(0.0001, t + 2); // fade out: never a hard cut
      var nodes = s.nodes.slice();
      var master = s.master;
      setTimeout(function () {
        var i;
        for (i = 0; i < nodes.length; i++) {
          try { nodes[i].node.stop(); } catch (e) {}
          try { nodes[i].node.disconnect(); } catch (e) {}
        }
        try { master.disconnect(); } catch (e) {}
      }, 2300);
    } catch (e) {}
  }

  window.Drift = {
    version: VERSION,
    start: start,
    stop: stop,
    isPlaying: function () { return !!S; },
    /* Internals below: exposed for automated testing only. */
    _tick: tick,
    _debug: function () {
      if (!S) { return null; }
      return { events: S.events, nodeCount: S.nodes.length, loops: S.loops, idx: S.idx };
    }
  };
})();
