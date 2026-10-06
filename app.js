/* I Hate Trains — v9. Free forever. Feel-first, quality over quantity. Offline-first: no network in core flows. */
(function () {
  'use strict';

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function currentScreen() { var a = document.querySelector('.screen.active'); return a ? a.id : null; }
  var navBack = [], navFwd = [];
  function go(id, opts) {
    opts = opts || {};
    var cur = currentScreen();
    if (!opts.keep && cur && cur !== id) { navBack.push(cur); if (navBack.length > 30) { navBack.shift(); } navFwd = []; }
    $all('.screen').forEach(function (s) { s.classList.remove('active'); });
    var el = $(id);
    if (el) { el.classList.add('active'); window.scrollTo(0, 0); }
    if (id !== 'screen-breathe') { stopBreathe(); } // leaving the exercise always stops it cleanly
    updateSosFloat(id);
  }
  function navGoBack() { var p = navBack.pop(); if (!p) { return; } navFwd.push(currentScreen()); tick(); go(p, { keep: true }); }
  function navGoFwd() { var n = navFwd.pop(); if (!n) { return; } var c = currentScreen(); if (c) { navBack.push(c); } tick(); go(n, { keep: true }); }
  /* swipe navigation: right = back, left = forward. Gesture zones are namespaced — swipes starting
     inside interactive tool zones, inputs, or buttons never navigate. */
  var swipeStart = null;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { swipeStart = null; return; }
    var t = e.target;
    if (t && t.closest && t.closest('.swipezone, .tracewrap, .holdbtn, input, textarea, select, button, a')) { swipeStart = null; return; }
    swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!swipeStart) { return; }
    var t = e.changedTouches[0];
    var dx = t.clientX - swipeStart.x, dy = t.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.4) { return; } // needs a real horizontal swipe
    if (dx > 0) { navGoBack(); } else { navGoFwd(); }
  }, { passive: true });
  /* SOS stays one tap away on every screen except home (has the big button), the panic flow itself, and onboarding */
  var SOS_HIDDEN = { 'screen-home': 1, 'screen-panic': 1, 'screen-breathe': 1, 'screen-ob1': 1, 'screen-ob2': 1, 'screen-ob3': 1, 'screen-ob4': 1, 'screen-tour': 1 };
  function updateSosFloat(id) {
    var f = $('sos-float');
    if (f) { f.hidden = !!SOS_HIDDEN[id]; }
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function readJSON(k, fb) { try { var v = JSON.parse(read(k)); return v == null ? fb : v; } catch (e) { return fb; } }

  /* ---------- prefs ---------- */
  var prefs = readJSON('iht_prefs', null) || {};
  if (typeof prefs.haptics !== 'boolean') { prefs.haptics = true; }
  if (typeof prefs.breathSound !== 'string') { // chimes | ambient | both | off — default keeps v8 behavior
    prefs.breathSound = (prefs.sound === false) ? 'off' : 'chimes';
    try { delete prefs.sound; } catch (e) {}
  }
  if (typeof prefs.theme !== 'string') { prefs.theme = 'auto'; } // auto | toronto | london | newyork | paris | tokyo | night
  if (!prefs.locale && navigator.language) { prefs.locale = navigator.language; } // locale hook: per-country copy variants later
  function savePrefs() { store('iht_prefs', JSON.stringify(prefs)); }
  savePrefs();

  /* ---------- profile (from onboarding, on-device) ---------- */
  var profile = readJSON('iht_profile', null) || {};
  function saveProfile() { store('iht_profile', JSON.stringify(profile)); }

  /* ---------- city themes: the app dresses for the city you're riding in.
     Brand surfaces only. The sacred flow (panic, breathe, grounding, crisis) stays universal calm dark. Ever. ---------- */
  var THEMES = {
    toronto: { nick: 'The 6ix', match: ['toronto'],
      lede: 'Same. The TTC is doing TTC things. Let\u2019s get through this ride together.',
      checkin: 'The TTC can wait a minute.',
      arrived: 'That took courage — not even a short-turn could stop you.' },
    london: { nick: 'Mind the gap', match: ['london'],
      lede: 'Same. The Tube sends its regards — and its delays.',
      checkin: 'Signal failures can wait.',
      arrived: 'That took courage. Mind the gap — you cleared it.' },
    newyork: { nick: 'The city that never sleeps', match: ['new york', 'nyc'],
      lede: 'Same. The MTA said \u201Cgood service\u201D. Sure.',
      checkin: 'The MTA can wait.',
      arrived: 'That took courage. Showtime\u2019s over — you made it.' },
    paris: { nick: 'Métro life', match: ['paris'],
      lede: 'Same. The m\u00E9tro smells like it always does. On y va.',
      checkin: 'The m\u00E9tro can wait.',
      arrived: 'That took courage. Arriv\u00E9 — the m\u00E9tro didn\u2019t win today.' },
    tokyo: { nick: 'Sardine car', match: ['tokyo'],
      lede: 'Same. One with the rush-hour crowd. Breathe anyway.',
      checkin: 'Rush hour can wait.',
      arrived: 'That took courage. Otsukaresama — you rode it out.' },
    night: { nick: 'Somewhere underground', match: [],
      lede: 'Same. Let\u2019s get through this ride together.',
      checkin: '',
      arrived: 'That took courage.' }
  };
  var tripActive = false;
  function themeCity() {
    if (tripActive && trip.city) { return trip.city; }
    return profile.city || '';
  }
  function detectTheme() {
    if (prefs.theme && prefs.theme !== 'auto') { return prefs.theme; }
    var city = themeCity().toLowerCase();
    var keys = Object.keys(THEMES);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'night') { continue; }
      var m = THEMES[k].match;
      for (var j = 0; j < m.length; j++) { if (city.indexOf(m[j]) !== -1) { return k; } }
    }
    return 'night';
  }
  function renderThemeSeg() {
    var cur = prefs.theme || 'auto';
    $all('#theme-seg .segbtn').forEach(function (b) {
      var on = b.getAttribute('data-theme') === cur;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function applyTheme() {
    var key = detectTheme();
    var th = THEMES[key] || THEMES.night;
    document.body.setAttribute('data-theme', key);
    var nm = (profile.name || '').trim();
    $('home-greet').textContent = (nm ? 'Hey ' + nm + '. ' : '') + th.lede;
    var cl = $('home-cityline'); if (cl) { cl.textContent = th.nick; }
    var sl = $('checkin-theme-line'); if (sl) { sl.textContent = th.checkin; sl.style.display = th.checkin ? '' : 'none'; }
    var al = $('arrived-lede'); if (al) { al.textContent = th.arrived; }
    renderThemeSeg();
  }
  $all('#theme-seg .segbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      prefs.theme = b.getAttribute('data-theme');
      savePrefs(); applyTheme();
    });
  });

  /* ---------- haptics: Android-only (iOS Safari has no Vibration API), feature-detected, user toggle ---------- */
  var canBuzz = ('vibrate' in navigator);
  function buzz(pattern) {
    if (!prefs.haptics || !canBuzz) { return; }
    try { navigator.vibrate(pattern); } catch (e) {}
  }
  function tick() { buzz(12); } // soft press tick
  function breathHaptic(phase) {
    if (phase === 'in') { buzz([28, 70, 28, 70, 28]); }       // gentle pulses rising
    else if (phase === 'out') { buzz(160); }                    // one soft long exhale buzz
    // hold: silence
  }

  /* ---------- nav ---------- */
  $all('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { tick(); go(b.getAttribute('data-go')); });
  });

  /* ---------- the coping library (ported from the Manus native build, steps + safety notes intact) ---------- */
  var CAT_LABEL = { ground: 'Ground', touch: 'Touch', breath: 'Breathe', understand: 'Understand', distract: 'Distract', plan: 'Plan', reflect: 'Reflect' };
  var TOOLS = [
    { id: 'five-senses', title: '5–4–3–2–1 senses', cat: 'ground', time: 'A few minutes',
      summary: 'Let the carriage around you be the place you are, one sense at a time.',
      steps: ['Name five things you can see, noticing color or shape.', 'Notice four things you can feel: your feet, fabric, a cool surface, or your hands.', 'Listen for three sounds. They can be quiet or ordinary.', 'Notice two smells, or two neutral details if smells are hard to notice.', 'Notice one taste, or the feeling of your mouth. You can skip any sense.'] },
    { id: 'three-three-three', title: '3–3–3 noticing', cat: 'ground', time: 'About a minute',
      summary: 'A shorter sensory route that does not ask you to change your breathing.',
      steps: ['Find three things you can see.', 'Find three things you can hear.', 'Notice three physical sensations where your body meets the seat, floor, or clothing.'] },
    { id: 'object-detail', title: 'One-object details', cat: 'ground', time: '30 seconds or more',
      summary: 'Pick one nearby object and let its details hold your attention.',
      steps: ['Choose an object you can see, such as a sign, shoe, or window edge.', 'Notice its outline, colors, texture, and the way light falls on it.', 'If your mind wanders, simply return to one detail. Nothing to get right.'] },
    { id: 'safe-place', title: 'A familiar safe place', cat: 'ground', time: 'About a minute',
      summary: 'Picture somewhere familiar or imagined that feels comforting enough.',
      steps: ['Bring to mind a real or imagined place you like.', 'Notice one color, one sound, and one texture from that place.', 'You do not need to feel calm or finish the image. Return to the carriage whenever you want.'] },
    { id: 'med-body-scan', title: 'One-minute body scan', cat: 'ground', time: 'About a minute',
      summary: 'Move attention slowly through the body. Notice — don\u2019t fix.',
      steps: ['Rest your attention on the top of your head. Notice any sensation, or none at all.', 'Let it drift down to your shoulders. If they\u2019re tight, you don\u2019t have to change it — just notice.', 'Move to your hands. Feel their weight, warmth, or stillness.', 'Down to your feet on the floor. Notice the support under you.', 'That\u2019s it. You can stop here, or run it again.'],
      safety: 'This is a coping tool, not treatment. Stop any time.' },
    { id: 'med-kind-wishes', title: 'Warm wishes', cat: 'ground', time: 'About a minute',
      summary: 'Three quiet phrases — first for you, then for someone you love.',
      steps: ['Silently, to yourself: \u201CMay I be steady.\u201D', 'Again, gently: \u201CMay I be safe.\u201D', 'Now picture someone you love: \u201CMay you be steady. May you be safe.\u201D', 'That\u2019s enough. Warmth counts, even if you don\u2019t feel it yet.'],
      safety: 'This is a coping tool, not treatment. Stop any time.' },
    { id: 'med-sounds', title: 'Sounds around you', cat: 'ground', time: 'About a minute',
      summary: 'Let the train\u2019s noise become the object — not the enemy.',
      steps: ['Notice the nearest sound to you. Just name it silently.', 'Now find the farthest sound you can hear.', 'Pick one sound in between and rest your attention there.', 'The noise isn\u2019t the enemy here. It\u2019s just sound, passing through.'],
      safety: 'This is a coping tool, not treatment. Stop any time.' },
    { id: 'swipe-breathe', title: 'Swipe breathing', cat: 'touch', time: 'As long as you like', screen: 'screen-swipebreathe',
      summary: 'The gesture is the pacer: swipe up slowly to breathe in, down to breathe out.' },
    { id: 'trace-calm', title: 'Trace calm', cat: 'touch', time: 'About a minute', screen: 'screen-trace',
      summary: 'Trace a slow circle with your finger. A ring fills as you go.' },
    { id: 'hold-steady', title: 'Hold to steady', cat: 'touch', time: 'As long as you like', screen: 'screen-hold',
      summary: 'Press and hold. A soft tone rises with you. Let go anytime.' },
    { id: 'muscle-release', title: 'Progressive muscle release', cat: 'ground', time: '30 seconds',
      summary: 'A gentle, seated tighten-and-release sequence. Skip any movement that does not feel comfortable.',
      steps: ['Let your hands rest. If comfortable, press your fingertips together gently for a moment, then release.', 'If it feels okay, lift your shoulders just a little without straining, then let them drop.', 'Optionally soften your jaw or face; skip this if it is uncomfortable.', 'Notice the support beneath you. Keep breathing however it happens naturally — this tool does not ask you to change your breath.'],
      safety: 'Do not tense around an injury or painful area. Stop any movement that hurts or feels unsafe; you can skip the movement and simply notice the chair supporting you.' },
    { id: 'kind-words', title: 'Kind, factual words', cat: 'ground', time: 'A few seconds',
      summary: 'Choose a line that feels believable — not a promise you have to force yourself to believe.',
      steps: ['Try: This is a hard moment, and I can choose one small next step.', 'Or: I am allowed to ask someone for support.', 'Or use your own words. You do not have to feel reassured for this to count.'] },
    { id: 'breath-box', title: 'Even square breathing', cat: 'breath', time: 'Three gentle cycles', pattern: 'box',
      summary: 'An optional paced-breathing exercise with even sides.',
      steps: ['Choose this only if paying attention to breathing feels okay.', 'Let the cues guide a gentle in-breath, a comfortable pause, a gentle out-breath, and a comfortable rest.', 'You can stop or switch to grounding at any point.'],
      safety: 'Breathing practices are optional coping tools, not treatment. Stop immediately if breathing feels difficult or uncomfortable; switch to a non-breath grounding tool.' },
    { id: 'breath-478', title: '4–7–8 breathing', cat: 'breath', time: 'Two gentle cycles', pattern: '478',
      summary: 'A longer, unhurried out-breath. The pause is optional.',
      steps: ['Choose this only if it feels comfortable to focus on breathing.', 'Breathe in gently for about four seconds. Pause for up to seven only if comfortable.', 'Breathe out gently for about eight seconds; do not force the breath or hold it if that feels wrong.'],
      safety: 'Stop immediately if breathing feels difficult or uncomfortable. Switch to grounding or another non-breath option.' },
    { id: 'breath-sigh', title: 'Cyclic sigh (optional)', cat: 'breath', time: 'One comfortable round',
      summary: 'A comfortable inhale, a smaller second inhale, then a slow, easy out-breath. Untimed — go at your pace.',
      steps: ['Let a comfortable inhale happen through your nose if possible.', 'At the top, add a small second inhale only if that feels okay.', 'Let the air out slowly without forcing it. No breath hold or fixed pace is required. Repeat only if you want.'],
      safety: 'A 2023 study found mood and breathing-rate effects with daily cyclic sigh practice, but this is not evidence that it treats panic attacks. Stop if it feels uncomfortable and switch tools.' },
    { id: 'panic-facts', title: 'What panic can feel like', cat: 'understand', time: 'A short read',
      summary: 'A calm, factual reminder. This cannot tell you what is causing your symptoms.',
      steps: ['Panic can bring intense fear and physical sensations such as a pounding heart, dizziness, trembling, tingling, or breathing discomfort.', 'These sensations can be frightening. A panic response can rise and change over time; you do not have to solve it all at once.', 'An app cannot diagnose you. If symptoms are new, severe, or medically concerning, seek urgent medical help.'] },
    { id: 'thought-check', title: 'A gentle thought check', cat: 'understand', time: 'A minute or two',
      summary: 'A CBT-inspired reflection prompt. It is not therapy and you may skip it.',
      steps: ['Name the scary thought in a few words, without arguing with yourself.', 'Ask: what do I know for sure right now, and what is my fear predicting?', 'Offer one kinder, more balanced possibility: I can take one step and reassess.', 'This is a self-help prompt, not a substitute for CBT or professional care.'] },
    { id: 'categories', title: 'Quiet category game', cat: 'distract', time: 'As long as you like',
      summary: 'Give your attention a small, changeable task. No scoring and no rush.',
      steps: ['Choose a category you enjoy: foods, films, animals, plants, or places.', 'Think of one item at a time, at your own pace.', 'Change categories whenever you want. You can stop without finishing.'] },
    { id: 'backwards-count', title: 'Count backward (optional)', cat: 'distract', time: 'As long as you like',
      summary: 'A silent attention exercise. If counting does not help, choose another card instead.',
      steps: ['Start anywhere that feels easy, such as 20 or 10.', 'Count backward by ones, or skip this and pick another option.', 'No need to be exact; switch tools if this starts to feel frustrating.'] },
    { id: 'comfort-cue', title: 'Familiar comedy or music', cat: 'distract', time: 'Use at your own pace',
      summary: 'A comfort cue that you choose for yourself. The app does not stream or play media.',
      steps: ['If you want, think of a familiar joke, scene, song, or voice that feels like yours.', 'Use a saved clip from your own device only if you choose and it is already available offline.', 'If sound is not right for this moment, try object details or contact someone instead.'] },
    { id: 'ride-plan', title: 'My ride backup plan', cat: 'plan', time: 'Before boarding', goto: 'screen-plan',
      summary: 'Make a small plan while you have more headspace; no live transit data is used.', steps: [] },
    { id: 'confidence-ladder', title: 'Gentle confidence practice', cat: 'plan', time: 'Only when ready, before a ride', goto: 'screen-plan',
      summary: 'A private, gradual practice planner inspired by exposure principles — not a challenge.',
      steps: ['Choose a small practice that feels manageable and safe to you, or decide with a clinician.', 'You may pause, change plans, or leave at any time. No streak, score, or penalty.', 'Exposure-based CBT is treatment delivered with appropriate guidance; this planner is not therapy.'] },
    { id: 'post-ride', title: 'After-ride reflection', cat: 'reflect', time: 'Optional, about 30 seconds', goto: 'screen-reflect',
      summary: 'Notice what happened and what helped, without judging how the ride went.', steps: [] }
  ];
  function getTool(id) { for (var i = 0; i < TOOLS.length; i++) { if (TOOLS[i].id === id) { return TOOLS[i]; } } return null; }
  var NONBREATH_IDS = ['object-detail', 'comfort-cue', 'muscle-release', 'safe-place', 'kind-words', 'categories', 'trace-calm', 'hold-steady', 'med-body-scan', 'med-kind-wishes', 'med-sounds'];

  /* ---------- tool walkthrough (generic, paced, calm) ---------- */
  var walkReturn = 'screen-home', walkTool = null, walkIdx = 0;
  var gestureReturn = 'screen-home';
  function openTool(id, returnTo) {
    var t = getTool(id);
    if (!t) { return; }
    if (t.screen) { gestureReturn = returnTo || 'screen-home'; tick(); go(t.screen); return; }
    if (t.goto) { if (t.goto === 'screen-plan') { planReturn = returnTo || 'screen-home'; } tick(); go(t.goto); return; }
    walkTool = t; walkReturn = returnTo || 'screen-home'; walkIdx = 0;
    renderWalk(); tick(); go('screen-walk');
  }
  function renderWalk() {
    var t = walkTool, n = t.steps.length;
    $('walk-cat').textContent = CAT_LABEL[t.cat] || 'tool';
    $('walk-title').textContent = t.title;
    $('walk-count').textContent = (walkIdx + 1) + ' of ' + n;
    var p = $('walk-prompt');
    p.style.opacity = '0';
    setTimeout(function () {
      p.textContent = t.steps[walkIdx];
      p.style.opacity = '1';
    }, 160);
    $('walk-note').textContent = walkIdx === 0 ? t.time + ' · ' + t.summary : '';
    var s = $('walk-safety');
    if (t.safety && walkIdx === 0) { s.hidden = false; s.textContent = t.safety; }
    else { s.hidden = true; s.textContent = ''; }
    $('walk-fill').style.width = ((walkIdx + 1) / n * 100) + '%';
    $('btn-walk-back').style.visibility = walkIdx === 0 ? 'hidden' : 'visible';
    $('btn-walk-next').textContent = walkIdx === n - 1 ? 'Done' : 'Next';
  }
  $('btn-walk-next').addEventListener('click', function () {
    tick();
    if (walkIdx < walkTool.steps.length - 1) { walkIdx++; renderWalk(); }
    else { go(walkReturn); }
  });
  $('btn-walk-back').addEventListener('click', function () { tick(); if (walkIdx > 0) { walkIdx--; renderWalk(); } });
  $('btn-walk-close').addEventListener('click', function () { tick(); go(walkReturn); });

  /* ---------- toolkit + non-breath lists ---------- */
  function toolCard(t, returnTo) {
    var b = document.createElement('button');
    b.className = 'toolcard';
    var meta = document.createElement('div'); meta.className = 'tmeta'; meta.textContent = (CAT_LABEL[t.cat] || '') + ' · ' + t.time;
    var title = document.createElement('strong'); title.textContent = t.title;
    var sum = document.createElement('p'); sum.textContent = t.summary;
    b.appendChild(title); b.appendChild(meta); b.appendChild(sum);
    b.addEventListener('click', function () {
      if (t.pattern) { startBreathe(t.pattern, returnTo, false); }
      else { openTool(t.id, returnTo); }
    });
    return b;
  }
  (function renderToolkit() {
    var host = $('toolkit-groups');
    var order = ['ground', 'touch', 'breath', 'distract', 'understand', 'plan', 'reflect'];
    order.forEach(function (cat) {
      var items = TOOLS.filter(function (t) { return t.cat === cat; });
      if (!items.length) { return; }
      var h = document.createElement('p'); h.className = 'toolgroup'; h.textContent = CAT_LABEL[cat];
      host.appendChild(h);
      var list = document.createElement('div'); list.className = 'toolcards';
      items.forEach(function (t) { list.appendChild(toolCard(t, 'screen-toolkit')); });
      host.appendChild(list);
    });
  })();
  (function renderNonbreath() {
    var host = $('nonbreath-list');
    NONBREATH_IDS.forEach(function (id) {
      var t = getTool(id);
      if (t) { host.appendChild(toolCard(t, 'screen-nonbreath')); }
    });
  })();
  /* comfort as a toolkit solution card: no feature that requires discovery */
  (function renderToolkitComfort() {
    var host = $('toolkit-groups');
    if (!host) { return; }
    var b = document.createElement('button'); b.className = 'toolcard';
    var title = document.createElement('strong'); title.textContent = 'Something cute';
    var meta = document.createElement('div'); meta.className = 'tmeta'; meta.textContent = 'COMFORT \u00B7 Always here';
    var sum = document.createElement('p'); sum.textContent = 'Calm cards, cute animals, your one comfort — no searching, no homework.';
    b.appendChild(title); b.appendChild(meta); b.appendChild(sum);
    b.addEventListener('click', function () { comfortReturn = 'screen-toolkit'; tick(); go('screen-comfort'); });
    host.insertBefore(b, host.firstChild);
  })();
  /* guided minis inside the comfort solution view */
  (function renderMinis() {
    var host = $('mini-list');
    if (!host) { return; }
    ['med-body-scan', 'med-kind-wishes', 'med-sounds'].forEach(function (id) {
      var t = getTool(id);
      if (!t) { return; }
      var b = document.createElement('button'); b.className = 'linkcard';
      var label = document.createElement('span');
      var st = document.createElement('strong'); st.textContent = t.title;
      var em = document.createElement('span'); em.className = 'body'; em.textContent = t.time;
      label.appendChild(st); label.appendChild(document.createElement('br')); label.appendChild(em);
      var go2 = document.createElement('span'); go2.className = 'go'; go2.textContent = '\u2192';
      b.appendChild(label); b.appendChild(go2);
      b.addEventListener('click', function () { openTool(id, 'screen-comfort'); });
      host.appendChild(b);
    });
  })();

  /* ---------- audio cues: soft chimes marking breath phases (iOS-safe: context created on first user gesture) ---------- */
  var cueCtx = null;
  function ensureAudio() {
    try {
      if (!cueCtx) { cueCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      if (cueCtx.state === 'suspended') { cueCtx.resume(); }
    } catch (e) {}
    return cueCtx;
  }
  function chime(freq, secs, vol) {
    var ctx = cueCtx;
    if (!ctx) { return; }
    try {
      var t = ctx.currentTime;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + secs + 0.05);
    } catch (e) {}
  }
  function phaseCue(k) {
    var mode = prefs.breathSound || 'chimes';
    if (mode !== 'chimes' && mode !== 'both') { return; } // ambient/off: no chimes
    if (k === 'in') { chime(523.25, 1.1, 0.10); }      // soft high chime: breathe in
    else if (k === 'out') { chime(392.0, 1.4, 0.08); } // lower, softer: breathe out
    else { chime(440, 0.5, 0.035); }                  // hold/rest: barely-there tick
  }

  /* ---------- generative ambient pad: soft detuned oscillators through a lowpass, slow-evolving warm chord.
     Synthesized live with Web Audio — zero files, works fully offline, iOS-safe after the tap gesture. ---------- */
  var ambState = null;
  function ambientStart() {
    var ctx = ensureAudio();
    if (!ctx) { return; }
    ambientStop();
    try {
      var master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 4); // fade in slowly, never startling
      var filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 460; filt.Q.value = 0.5;
      filt.connect(master); master.connect(ctx.destination);
      var freqs = [110, 164.81, 220, 277.18]; // warm A-major-ish stack
      var oscs = [];
      freqs.forEach(function (f, i) {
        var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        o.detune.value = (i % 2 === 0 ? -6 : 6); // gentle detune = warmth
        var g = ctx.createGain(); g.gain.value = i < 2 ? 0.5 : 0.26;
        o.connect(g); g.connect(filt); o.start(); oscs.push(o);
      });
      var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.06; // ~17s evolution cycle
      var lfoG = ctx.createGain(); lfoG.gain.value = 200;
      lfo.connect(lfoG); lfoG.connect(filt.frequency); lfo.start();
      ambState = { ctx: ctx, oscs: oscs, lfo: lfo, master: master };
    } catch (e) { ambState = null; }
  }
  function ambientStop() {
    var s = ambState; ambState = null;
    if (!s) { return; }
    try {
      var ctx = s.ctx, t = ctx.currentTime;
      s.master.gain.cancelScheduledValues(t);
      s.master.gain.setValueAtTime(Math.max(s.master.gain.value, 0.0001), t);
      s.master.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); // fade out, never a hard cut
      setTimeout(function () {
        try { s.oscs.forEach(function (o) { o.stop(); }); s.lfo.stop(); } catch (e) {}
      }, 1600);
    } catch (e) {}
  }

  /* ---------- breathing engine (patterns + haptics + audio, minimal mode for the panic flow) ---------- */
  var breathTimer = null, breatheReturn = 'screen-home';
  var PATTERNS = {
    gentle: { label: 'Gentle', phases: [
      { k: 'in', secs: 4, word: 'Breathe in', cap: 'Slowly, through your nose.' },
      { k: 'hold', secs: 4, word: 'Hold', cap: 'Rest here a moment.' },
      { k: 'out', secs: 6, word: 'Breathe out', cap: 'Let your shoulders drop.' } ] },
    box: { label: 'Box', phases: [
      { k: 'in', secs: 4, word: 'Breathe in', cap: 'Four counts in.' },
      { k: 'hold', secs: 4, word: 'Hold', cap: 'Four counts held.' },
      { k: 'out', secs: 4, word: 'Breathe out', cap: 'Four counts out.' },
      { k: 'rest', secs: 4, word: 'Rest', cap: 'Four counts rest.' } ] },
    '478': { label: '4–7–8', phases: [
      { k: 'in', secs: 4, word: 'Breathe in', cap: 'Gently, four counts.' },
      { k: 'hold', secs: 7, word: 'Pause', cap: 'Only if comfortable — skip any time.' },
      { k: 'out', secs: 8, word: 'Breathe out', cap: 'Slow and easy. Never force it.' } ] }
  };
  var breathPattern = 'gentle';
  $all('#breath-patterns .pchip').forEach(function (c) {
    c.addEventListener('click', function () {
      tick();
      $all('#breath-patterns .pchip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      c.setAttribute('aria-pressed', 'true');
      breathPattern = c.getAttribute('data-pattern');
    });
  });
  function setBreathPattern(p) {
    breathPattern = p;
    $all('#breath-patterns .pchip').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-pattern') === p ? 'true' : 'false'); });
  }
  function runPhase(phases, i) {
    if (!$('screen-breathe').classList.contains('active')) { return; }
    var p = phases[i % phases.length];
    var word = $('breath-word'), cap = $('breath-cap');
    cap.classList.add('swap');
    setTimeout(function () {
      word.textContent = p.word;
      cap.textContent = p.cap;
      cap.classList.remove('swap');
    }, 200);
    var c = $('breath-circle');
    var grow = (p.k === 'in');
    c.style.transition = 'transform ' + p.secs + 's cubic-bezier(.37,0,.63,1)';
    void c.offsetWidth;
    c.style.transform = 'scale(' + (grow ? 1.32 : 1) + ')'; // the bloom opens and folds with the breath
    breathHaptic(p.k);
    phaseCue(p.k);
    breathTimer = setTimeout(function () { runPhase(phases, i + 1); }, p.secs * 1000);
  }
  function startBreathe(pattern, returnTo, minimal) {
    breatheReturn = returnTo || 'screen-home';
    stopBreathe();
    ensureAudio(); // first user gesture: safe to init audio on iOS
    setBreathPattern(pattern || 'gentle');
    $('breath-patterns').classList.toggle('hidden', !!minimal);
    var c = $('breath-circle');
    c.style.transition = 'none';
    c.style.transform = 'scale(1)';
    tick(); go('screen-breathe');
    var mode = prefs.breathSound || 'chimes';
    if (mode === 'ambient' || mode === 'both') { ambientStart(); }
    runPhase(PATTERNS[breathPattern].phases, 0); // no gate: the exercise starts NOW
  }
  function stopBreathe() { if (breathTimer) { clearTimeout(breathTimer); breathTimer = null; } ambientStop(); }
  $('btn-breathe-end').addEventListener('click', function () { tick(); stopBreathe(); go(breatheReturn); });

  /* panic entry: minimal sacred flow */
  $('btn-panic-breathe').addEventListener('click', function () { startBreathe('gentle', 'screen-panic', true); });
  $('btn-panic-ground').addEventListener('click', function () { openTool('five-senses', 'screen-panic'); });

  /* comfort is a solution, not a silo: reachable from the panic flow, the toolkit, home, and mid-trip */
  var comfortReturn = 'screen-home';
  $('btn-panic-comfort').addEventListener('click', function () { comfortReturn = 'screen-panic'; tick(); go('screen-comfort'); });
  $('btn-comfort-back').addEventListener('click', function () { tick(); go(comfortReturn); });
  $('link-comfort-home').addEventListener('click', function () { comfortReturn = 'screen-home'; });
  $('tool-comfort').addEventListener('click', function () { comfortReturn = 'screen-trip'; });

  /* the backup plan, one glance away from the panic flow */
  var planReturn = 'screen-home';
  $('btn-panic-plan').addEventListener('click', function () { planReturn = 'screen-panic'; tick(); go('screen-plan'); });
  $('btn-plan-back').addEventListener('click', function () { tick(); go(planReturn); });
  $('link-plan-home').addEventListener('click', function () { planReturn = 'screen-home'; });

  /* trip tools */
  $('tool-breathe').addEventListener('click', function () { startBreathe('gentle', 'screen-trip', false); });
  $('tool-ground').addEventListener('click', function () { openTool('five-senses', 'screen-trip'); });

  /* ---------- ambient hum (Web Audio, generated on-device, offline) ---------- */
  var actx = null, noiseNode = null, soundOn = false;
  function brownNoiseBuffer(ctx) {
    var len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    return buf;
  }
  $('tool-sound').addEventListener('click', function () {
    tick();
    var btn = $('tool-sound');
    if (!soundOn) {
      try {
        if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); }
        if (actx.state === 'suspended') { actx.resume(); }
        var src = actx.createBufferSource();
        src.buffer = brownNoiseBuffer(actx); src.loop = true;
        var filt = actx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 320;
        var gain = actx.createGain(); gain.gain.value = 0.1;
        src.connect(filt); filt.connect(gain); gain.connect(actx.destination);
        src.start();
        noiseNode = src; soundOn = true;
        btn.setAttribute('aria-pressed', 'true');
        $('sound-label').textContent = 'Hum on';
      } catch (e) { $('sound-label').textContent = 'Hum n/a'; }
    } else {
      try { if (noiseNode) { noiseNode.stop(); } } catch (e) {}
      noiseNode = null; soundOn = false;
      btn.setAttribute('aria-pressed', 'false');
      $('sound-label').textContent = 'Hum off';
    }
  });

  /* ---------- pre-ride check-in ---------- */
  var checkinFeel = null;
  var checkinNotes = {
    steady: 'Good. Let\u2019s keep it that way.',
    uneasy: 'That\u2019s okay. One stop at a time.',
    spiraling: 'Let\u2019s slow down first. There is no hurry.'
  };
  $all('#screen-checkin .feelbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      $all('#screen-checkin .feelbtn').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      checkinFeel = b.getAttribute('data-feel');
      $('checkin-note').textContent = checkinNotes[checkinFeel];
      $('checkin-actions').hidden = false;
      $('btn-checkin-breathe').hidden = checkinFeel !== 'spiraling';
      $('btn-checkin-continue').textContent = checkinFeel === 'spiraling' ? 'Start the ride anyway' : 'Continue';
    });
  });
  $('btn-checkin-breathe').addEventListener('click', function () { startBreathe('gentle', 'screen-checkin', true); });
  $('btn-checkin-continue').addEventListener('click', function () { tick(); go('screen-checklist'); });

  /* ---------- checklist ---------- */
  $all('#checklist .check').forEach(function (c) {
    c.addEventListener('click', function () {
      tick();
      c.classList.toggle('done');
      c.setAttribute('aria-pressed', c.classList.contains('done') ? 'true' : 'false');
    });
  });

  /* ---------- ride setup + location: try first, ask only if needed ---------- */
  var setupStops = 5;
  function renderSetupStops() { $('stops-count').textContent = setupStops; }
  $('stops-minus').addEventListener('click', function () { tick(); if (setupStops > 1) { setupStops--; renderSetupStops(); } });
  $('stops-plus').addEventListener('click', function () { tick(); if (setupStops < 40) { setupStops++; renderSetupStops(); } });
  renderSetupStops();

  /* ---------- location: try first, ask only if needed. Always visible, never silent. ---------- */
  function reverseGeocode(lat, lon, o) {
    fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=en')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var city = d.city || d.locality || '';
        if (city) {
          if (o.city) { o.city.value = city; }
          o.status.textContent = 'Looks like you\u2019re near ' + city + '. Fix it below if I\u2019m wrong — then tell us your line.';
        } else {
          o.status.textContent = 'Found your location, but couldn\u2019t name the city. Fill it in below.';
        }
      })
      .catch(function () {
        o.status.textContent = 'Found your location, but the city lookup needs internet. Fill it in below.';
      });
  }
  var locDone = {};
  function tryLocate(o) {
    /* o: { status: el, city: inputEl?, retry: btnEl?, onceKey: string } */
    if (locDone[o.onceKey]) { return; }
    locDone[o.onceKey] = true;
    var st = o.status;
    if (o.retry) { o.retry.hidden = true; o.retry.onclick = null; }
    if (!('geolocation' in navigator)) {
      st.textContent = 'This device can\u2019t locate itself. The fields below are all yours.';
      return;
    }
    st.textContent = 'Trying to find you… (GPS often can\u2019t reach underground — no worries either way.)';
    var done = false;
    function fail(msg) {
      if (done) { return; }
      done = true;
      st.textContent = msg;
      if (o.retry) {
        o.retry.hidden = false;
        o.retry.onclick = function () { tick(); locDone[o.onceKey] = false; tryLocate(o); };
      }
    }
    var timer = setTimeout(function () { fail('No GPS fix — totally normal underground. Tell us your ride below.'); }, 8000);
    navigator.geolocation.getCurrentPosition(function (pos) {
      if (done) { return; }
      done = true; clearTimeout(timer);
      var lat = pos.coords.latitude.toFixed(3), lon = pos.coords.longitude.toFixed(3);
      if (navigator.onLine) { reverseGeocode(lat, lon, o); }
      else { st.textContent = 'Got your location (' + lat + ', ' + lon + ') but you\u2019re offline, so no city name. Fill it in below.'; }
    }, function () {
      clearTimeout(timer);
      fail('No GPS fix — totally normal underground. Tell us your ride below.');
    }, { timeout: 7900, maximumAge: 600000 });
  }
  /* ride setup: prefill from profile, then attempt location once per session */
  $all('[data-go="screen-setup"]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!$('in-city').value && profile.city) { $('in-city').value = profile.city; }
      if (!$('in-line').value && profile.line) { $('in-line').value = profile.line; }
      setTimeout(function () { tryLocate({ status: $('loc-status'), city: $('in-city'), onceKey: 'setup' }); }, 350);
    });
  });

  var trip = { city: '', line: '', dest: '', left: 0, total: 0 };
  var tripCardSent = false;
  function arrivedNote() {
    $('home-note').textContent = tripCardSent
      ? 'Your person has your trip card with the ETA.'
      : 'Take a breath. You\u2019re off the train.';
  }
  $('btn-start-trip').addEventListener('click', function () {
    tick();
    trip.city = $('in-city').value.trim();
    trip.line = $('in-line').value.trim();
    trip.dest = $('in-dest').value.trim();
    trip.total = setupStops;
    trip.left = setupStops;
    tripCardSent = false;
    tripActive = true;
    applyTheme(); // ride city can differ from home base (hello, Italy)
    var route = (trip.city ? trip.city + ' · ' : '') + (trip.line ? trip.line + ' \u2192 ' : '') + (trip.dest ? trip.dest : 'On your way');
    $('trip-route').textContent = route;
    var nm = (profile.name || '').trim();
    $('trip-fine').textContent = nm
      ? ('One tap per stop, ' + nm + '. That\u2019s all you have to do.')
      : 'One tap per stop. That\u2019s all you have to do.';
    renderStops();
    go('screen-trip');
  });

  /* ---------- stop counter: the calm ritual ---------- */
  function renderStops() {
    $('stops-left').textContent = trip.left;
    $('stops-word').textContent = trip.left === 1 ? 'stop to go' : 'stops to go';
  }
  $('btn-stop-tap').addEventListener('click', function () {
    buzz(25);
    var n = $('stops-left');
    n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
    if (trip.left > 0) { trip.left--; renderStops(); }
    if (trip.left === 0) { setTimeout(function () { arrivedNote(); go('screen-arrived'); }, 600); }
  });
  $('btn-end-trip').addEventListener('click', function () { tick(); arrivedNote(); go('screen-arrived'); });

  /* ---------- trip card share (online-enhanced, never a dead end) ---------- */
  $('btn-share-card').addEventListener('click', function () {
    tick();
    var city = $('in-city').value.trim();
    var line = $('in-line').value.trim() || 'the train';
    var dest = $('in-dest').value.trim() || 'my stop';
    var mins = setupStops * 3;
    var eta = new Date(Date.now() + mins * 60000);
    var etaStr = eta.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    var text = 'Riding ' + (city ? city + ' ' : '') + line + ' to ' + dest + ' (' + setupStops + ' stops, ETA ~' + etaStr + '). If I go quiet past ' + etaStr + ', check on me. \u2014 via I Hate Trains';
    var hint = $('share-hint');
    function done(msg, sent) { hint.textContent = msg; if (sent) { tripCardSent = true; } }
    if (navigator.share) {
      navigator.share({ title: 'My trip card', text: text }).then(function () { done('Trip card sent. They have your ETA.', true); }, function () { done('Share dismissed. The card is still yours to send.'); });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done('Trip card copied. Paste it to your person.', true); }, function () { done(text); });
    } else {
      done(text);
    }
  });

  /* ---------- I'm home → reflection ---------- */
  $('btn-im-home').addEventListener('click', function () {
    tick();
    $all('#screen-reflect .feelbtn').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    $all('#reflect-tools .chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    $('in-reflect').value = '';
    reflectAfter = null; reflectTools = [];
    go('screen-reflect');
  });

  /* ---------- post-ride reflection (private, on-device, no scores) ---------- */
  var reflectAfter = null, reflectTools = [];
  $all('#screen-reflect .feelbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      $all('#screen-reflect .feelbtn').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      reflectAfter = b.getAttribute('data-r');
    });
  });
  (function renderReflectTools() {
    var host = $('reflect-tools');
    TOOLS.filter(function (t) { return t.steps && t.steps.length; }).forEach(function (t) {
      var c = document.createElement('button');
      c.className = 'chip'; c.setAttribute('aria-pressed', 'false'); c.textContent = t.title;
      c.addEventListener('click', function () {
        tick();
        var on = c.getAttribute('aria-pressed') === 'true';
        c.setAttribute('aria-pressed', on ? 'false' : 'true');
        if (on) { reflectTools = reflectTools.filter(function (x) { return x !== t.title; }); }
        else { reflectTools.push(t.title); }
      });
      host.appendChild(c);
    });
  })();
  $('btn-reflect-done').addEventListener('click', function () {
    tick();
    try {
      var log = readJSON('iht_journal', []);
      log.push({ t: new Date().toISOString(), before: checkinFeel, after: reflectAfter, tools: reflectTools.slice(), note: $('in-reflect').value.trim().slice(0, 280) });
      store('iht_journal', JSON.stringify(log.slice(-100)));
    } catch (e) {}
    try { store('iht_trips', String((parseInt(read('iht_trips') || '0', 10) || 0) + 1)); } catch (e) {}
    checkinFeel = null; reflectAfter = null; reflectTools = [];
    tripActive = false;
    applyTheme();
    go('screen-home');
  });

  /* ---------- history ---------- */
  function feelingWord(f) { return { calmer: 'Calmer', same: 'Same', harder: 'Harder', steady: 'Steady', uneasy: 'Uneasy', spiraling: 'Spiraling' }[f] || ''; }
  function renderHistory() {
    var host = $('history-list');
    host.innerHTML = '';
    var log = readJSON('iht_journal', []);
    if (!log.length) {
      var p = document.createElement('p'); p.className = 'histempty';
      p.textContent = 'Nothing here yet. After a ride, you can note how it went — only for you.';
      host.appendChild(p);
      return;
    }
    log.slice().reverse().forEach(function (e) {
      var d = document.createElement('div'); d.className = 'histitem';
      var dt = document.createElement('div'); dt.className = 'hdate';
      try { dt.textContent = new Date(e.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (err) { dt.textContent = ''; }
      var f = document.createElement('div'); f.className = 'hfeel';
      var bits = [];
      if (e.before) { bits.push('Felt ' + feelingWord(e.before).toLowerCase() + ' before'); }
      if (e.after) { bits.push('felt ' + feelingWord(e.after).toLowerCase() + ' after'); }
      f.textContent = bits.join(' · ') || 'A ride';
      d.appendChild(dt); d.appendChild(f);
      if (e.tools && e.tools.length) {
        var tl = document.createElement('div'); tl.className = 'htools';
        tl.textContent = 'Helped: ' + e.tools.join(', ');
        d.appendChild(tl);
      }
      if (e.note) {
        var n = document.createElement('div'); n.className = 'hnote';
        n.textContent = '\u201C' + e.note + '\u201D';
        d.appendChild(n);
      }
      host.appendChild(d);
    });
  }
  $all('[data-go="screen-history"]').forEach(function (b) { b.addEventListener('click', renderHistory); });

  /* ---------- my plan ---------- */
  var plan = readJSON('iht_plan', null) || { exit: '', reach: '', pocket: ['Water', 'Headphones'], c1: '', c2: '', c3: '' };
  function savePlan(msg) {
    store('iht_plan', JSON.stringify(plan));
    if (msg) { $('plan-saved').textContent = msg; }
  }
  function renderPlan() {
    $('plan-exit').value = plan.exit || '';
    $('plan-reach').value = plan.reach || '';
    $('plan-c1').value = plan.c1 || '';
    $('plan-c2').value = plan.c2 || '';
    $('plan-c3').value = plan.c3 || '';
    var host = $('plan-pocket'); host.innerHTML = '';
    (plan.pocket || []).forEach(function (item, i) {
      var c = document.createElement('button');
      c.className = 'chip'; c.setAttribute('aria-pressed', 'false');
      var label = document.createElement('span'); label.textContent = item;
      var x = document.createElement('span'); x.className = 'x'; x.textContent = '✕';
      c.appendChild(label); c.appendChild(x);
      c.addEventListener('click', function () { tick(); plan.pocket.splice(i, 1); savePlan('Saved.'); renderPlan(); });
      host.appendChild(c);
    });
    $('plan-saved').textContent = '';
  }
  [['plan-exit', 'exit'], ['plan-reach', 'reach'], ['plan-c1', 'c1'], ['plan-c2', 'c2'], ['plan-c3', 'c3']].forEach(function (pair) {
    $(pair[0]).addEventListener('input', function () { plan[pair[1]] = $(pair[0]).value; savePlan(); });
    $(pair[0]).addEventListener('change', function () { savePlan('Saved on this phone.'); });
  });
  $('plan-pocket-add').addEventListener('click', function () {
    tick();
    var v = $('plan-pocket-in').value.trim().slice(0, 60);
    if (v) { plan.pocket.push(v); $('plan-pocket-in').value = ''; savePlan('Saved.'); renderPlan(); }
  });
  $all('[data-go="screen-plan"]').forEach(function (b) { b.addEventListener('click', renderPlan); });
  renderPlan();

  /* ---------- comfort corner: bundled calm (always) + one comfort (online) ---------- */
  var KIND_NOTES = [
    'This ride will end. You\u2019re doing great.',
    'You\u2019ve survived every bad ride so far.',
    'One stop at a time is enough.',
    'You\u2019re allowed to take up space and breathe.'
  ];
  var CALM_CARDS = [
    { id: 'sky', title: 'Slow sky',
      art: '<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="28" fill="#26314d"/><circle cx="60" cy="74" r="24" fill="#e8a86f"/><rect y="82" width="120" height="38" fill="#1a2133"/><rect y="80" width="120" height="4" fill="#e8a86f" opacity="0.5"/></svg>',
      note: 'The sky is doing this somewhere right now.' },
    { id: 'puppy', title: 'Puppy',
      art: '<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="28" fill="#3a2f28"/><ellipse cx="34" cy="52" rx="12" ry="22" fill="#6b543f" transform="rotate(18 34 52)"/><ellipse cx="86" cy="52" rx="12" ry="22" fill="#6b543f" transform="rotate(-18 86 52)"/><circle cx="60" cy="62" r="28" fill="#8a6f52"/><circle cx="50" cy="56" r="4" fill="#1a1410"/><circle cx="70" cy="56" r="4" fill="#1a1410"/><ellipse cx="60" cy="70" rx="7" ry="5" fill="#1a1410"/><path d="M60 75 q0 6 -7 6 M60 75 q0 6 7 6" stroke="#1a1410" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
      note: 'Somewhere, a dog is thrilled to see you.' },
    { id: 'ocean', title: 'Ocean',
      art: '<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="28" fill="#1e3a4d"/><path d="M0 50 q15 -12 30 0 t30 0 t30 0 t30 0" stroke="#7fb6c9" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M0 72 q15 -12 30 0 t30 0 t30 0 t30 0" stroke="#5d93ab" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M0 94 q15 -12 30 0 t30 0 t30 0 t30 0" stroke="#3f6d84" stroke-width="5" fill="none" stroke-linecap="round"/></svg>',
      note: 'In\u2026 and out. Like the tide.' },
    { id: 'words', title: 'Kind words',
      art: '<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="28" fill="#4d2f3a"/><path d="M60 92 C40 76 28 64 28 50 C28 40 36 34 44 34 C51 34 57 38 60 44 C63 38 69 34 76 34 C84 34 92 40 92 50 C92 64 80 76 60 92 Z" fill="#d98a9e"/></svg>',
      note: null },
    { id: 'stars', title: 'Night sky',
      art: '<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="28" fill="#141a2e"/><circle cx="82" cy="34" r="14" fill="#e8e4d2"/><circle cx="77" cy="30" r="12" fill="#141a2e"/><circle cx="30" cy="40" r="2.5" fill="#fff"/><circle cx="52" cy="70" r="2" fill="#fff"/><circle cx="40" cy="92" r="2.5" fill="#fff"/><circle cx="70" cy="88" r="2" fill="#fff"/><circle cx="95" cy="70" r="2.5" fill="#fff"/><circle cx="22" cy="66" r="2" fill="#fff"/></svg>',
      note: 'Above the tunnel, the stars are still there.' },
    { id: 'cup', title: 'Warm drink',
      art: '<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="28" fill="#2e3b33"/><path d="M48 34 q6 -8 0 -16 M62 34 q6 -8 0 -16" stroke="#a8c4b5" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="36" y="44" width="48" height="44" rx="10" fill="#d9c6a5"/><rect x="84" y="52" width="14" height="22" rx="7" fill="none" stroke="#d9c6a5" stroke-width="6"/><rect x="36" y="44" width="48" height="10" rx="5" fill="#b89a6e"/></svg>',
      note: 'Picture something warm in your hands.' }
  ];
  var calmReturn = 'screen-comfort';
  function renderCalmGrid() {
    var host = $('calm-grid'); if (!host || host.children.length) { return; }
    CALM_CARDS.forEach(function (c) {
      var b = document.createElement('button'); b.className = 'calmcard';
      b.setAttribute('aria-label', c.title);
      b.innerHTML = '<span class="calmthumb">' + c.art + '</span><span class="calmtitle">' + c.title + '</span>';
      b.addEventListener('click', function () { tick(); openCalm(c.id, 'screen-comfort'); });
      host.appendChild(b);
    });
  }
  function openCalm(id, returnTo) {
    var c = null;
    CALM_CARDS.forEach(function (x) { if (x.id === id) { c = x; } });
    if (!c) { return; }
    calmReturn = returnTo || 'screen-comfort';
    $('calm-art').innerHTML = c.art;
    $('calm-note').textContent = c.note || KIND_NOTES[Math.floor(Math.random() * KIND_NOTES.length)];
    go('screen-calm');
  }
  $('btn-calm-done').addEventListener('click', function () { tick(); go(calmReturn); });
  /* cute things, one tap: curated categories, pick a platform once */
  var SOCIAL_PLAT = 'yt';
  var SOCIAL_CATS = [
    { id: 'puppies', title: 'Puppies', emoji: '\uD83D\uDC36', q: 'cute puppies' },
    { id: 'kittens', title: 'Kittens', emoji: '\uD83D\uDC31', q: 'cute kittens' },
    { id: 'babies', title: 'Baby animals', emoji: '\uD83D\uDC23', q: 'cute baby animals' },
    { id: 'funny', title: 'Something funny', emoji: '\uD83D\uDE02', q: 'funny animals' },
    { id: 'nature', title: 'Calm nature', emoji: '\uD83C\uDF3F', q: 'relaxing nature' }
  ];
  function socialUrl(cat) {
    if (SOCIAL_PLAT === 'tt') { return 'https://www.tiktok.com/search?q=' + encodeURIComponent(cat.q); }
    if (SOCIAL_PLAT === 'ig') { return 'https://www.instagram.com/explore/'; }
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(cat.q);
  }
  function renderSocialGrid() {
    var host = $('social-grid'); if (!host || host.children.length) { return; }
    SOCIAL_CATS.forEach(function (c) {
      var b = document.createElement('button'); b.className = 'calmcard socialcard';
      b.setAttribute('aria-label', c.title);
      b.innerHTML = '<span class="calmemo">' + c.emoji + '</span><span class="calmtitle">' + c.title + '</span>';
      b.addEventListener('click', function () {
        tick();
        if (!navigator.onLine) { return; }
        window.open(socialUrl(c), '_blank', 'noopener');
      });
      host.appendChild(b);
    });
  }
  $all('#social-seg .segbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      SOCIAL_PLAT = b.getAttribute('data-plat');
      $all('#social-seg .segbtn').forEach(function (x) {
        var on = x === b;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  });
  /* one comfort: a single favorite link, online only */
  function getOneComfort() { return (read('iht_comfort_one') || '').trim(); }
  function setOneComfort(url) {
    url = (url || '').trim();
    if (!/^https?:\/\//i.test(url)) { return false; }
    store('iht_comfort_one', url); return true;
  }
  (function migrateComfort() {
    if (getOneComfort()) { return; }
    var old = readJSON('iht_comfort', []);
    if (old.length && old[0].url) { store('iht_comfort_one', old[0].url); }
    try { localStorage.removeItem('iht_comfort'); } catch (e) {}
    /* pre-seed so the button never sits empty: cute puppies on YouTube */
    if (!getOneComfort()) { store('iht_comfort_one', 'https://www.youtube.com/results?search_query=cute+puppies'); }
  })();
  function renderOneComfort() {
    var url = getOneComfort(), online = navigator.onLine;
    var btn = $('btn-one-comfort'), note = $('one-comfort-note');
    btn.disabled = !online || !url;
    if (!url) { note.textContent = 'Save one above — a reel, a playlist, whatever steadies you.'; }
    else if (!online) { note.textContent = 'Needs internet — the calm cards above work offline.'; }
    else { note.textContent = 'Opens in your browser.'; }
  }
  $('btn-one-comfort').addEventListener('click', function () {
    tick();
    var url = getOneComfort();
    if (!url) { $('one-comfort-url').focus(); return; }
    if (!navigator.onLine) { return; }
    window.open(url, '_blank', 'noopener');
  });
  $('one-comfort-save').addEventListener('click', function () {
    tick();
    if (!setOneComfort($('one-comfort-url').value)) { $('one-comfort-url').focus(); return; }
    $('one-comfort-url').value = '';
    $('one-comfort-edit-row').classList.add('hidden');
    renderOneComfort();
  });
  $('btn-one-comfort-edit').addEventListener('click', function () {
    tick();
    var row = $('one-comfort-edit-row');
    row.classList.toggle('hidden');
    if (!row.classList.contains('hidden')) { $('one-comfort-url').focus(); }
  });
  function updateComfort() {
    renderOneComfort();
    var sg = $('social-grid'); if (sg) { sg.classList.toggle('dim', !navigator.onLine); }
  }
  window.addEventListener('online', updateComfort);
  window.addEventListener('offline', updateComfort);
  renderCalmGrid();
  renderSocialGrid();
  updateComfort();

  /* ---------- crisis: rider-entered local number ---------- */
  function renderCrisisLocal() {
    var num = (read('iht_crisis_local') || '').trim();
    var a = $('crisis-local');
    if (num) {
      a.hidden = false;
      $('crisis-local-num').textContent = num;
      a.href = 'tel:' + num.replace(/[^+\d]/g, '');
    } else { a.hidden = true; }
  }
  $('in-crisis-local').addEventListener('change', function () {
    store('iht_crisis_local', $('in-crisis-local').value.trim().slice(0, 30));
    renderCrisisLocal();
  });
  $all('[data-go="screen-crisis"]').forEach(function (b) {
    b.addEventListener('click', function () {
      $('in-crisis-local').value = read('iht_crisis_local') || '';
      renderCrisisLocal();
    });
  });

  /* ---------- onboarding (first launch only): name → location → feeling → comforts ---------- */
  var obFeel = null;
  function enterOb2() {
    go('screen-ob2');
    tryLocate({ status: $('ob-loc-status'), city: $('ob-city'), retry: $('btn-ob-loc-retry'), onceKey: 'ob' });
  }
  $('btn-ob1-next').addEventListener('click', function () {
    tick();
    profile.name = $('ob-name').value.trim().slice(0, 40);
    saveProfile();
    enterOb2();
  });
  $('btn-ob1-skip').addEventListener('click', function () { tick(); enterOb2(); });
  $('btn-ob2-next').addEventListener('click', function () {
    tick();
    profile.city = $('ob-city').value.trim().slice(0, 60);
    profile.line = $('ob-line').value.trim().slice(0, 60);
    saveProfile();
    applyTheme(); // the app dresses for the city as soon as it knows it
    go('screen-ob3');
  });
  $('btn-ob2-back').addEventListener('click', function () { tick(); go('screen-ob1'); });
  var obFeelNotes = {
    steady: 'Good. The app will keep it simple.',
    uneasy: 'That\u2019s okay. One stop at a time.',
    spiraling: 'We\u2019ve got you. The big red button is always one tap away.'
  };
  $all('#ob-feel .feelbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      $all('#ob-feel .feelbtn').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      obFeel = b.getAttribute('data-feel');
      $('ob-feel-note').textContent = obFeelNotes[obFeel];
    });
  });
  $('btn-ob3-next').addEventListener('click', function () {
    tick();
    if (obFeel) { profile.feeling = obFeel; checkinFeel = obFeel; saveProfile(); }
    go('screen-ob4');
  });
  $('btn-ob3-back').addEventListener('click', function () { tick(); enterOb2(); });
  $('btn-ob4-done').addEventListener('click', function () {
    tick();
    var v = ($('ob-comfort-url').value || '').trim();
    if (v && /^https?:\/\//i.test(v)) { store('iht_comfort_one', v); }
    try { localStorage.setItem('iht_onboarded', '1'); } catch (e) {}
    applyProfileToHome();
    if (!read('iht_toured')) { startTour('screen-home'); }
    else { go('screen-home'); }
  });
  $('btn-ob4-back').addEventListener('click', function () { tick(); go('screen-ob3'); });

  /* ---------- home: greet by name, show the rider's usual ride, dress for the city ---------- */
  function applyProfileToHome() {
    var bits = [];
    if (profile.city) { bits.push(profile.city); }
    if (profile.line) { bits.push(profile.line); }
    $('home-ride-line').textContent = bits.length ? bits.join(' · ') : 'Your usual ride';
    applyTheme();
  }

  /* ---------- privacy: haptics + sound toggles, erase everything ---------- */
  function renderHaptics() {
    var b = $('set-haptics');
    b.classList.toggle('done', prefs.haptics);
    b.setAttribute('aria-pressed', prefs.haptics ? 'true' : 'false');
  }
  $('set-haptics').addEventListener('click', function () {
    prefs.haptics = !prefs.haptics;
    savePrefs(); renderHaptics(); tick();
  });
  renderHaptics();
  /* ---------- privacy: breathing sound picker (mirrors the one on the breathing screen) ---------- */
  function renderSoundSegs() {
    var cur = prefs.breathSound || 'chimes';
    $all('#breath-sound-seg .segbtn, #privacy-sound-seg .segbtn').forEach(function (b) {
      var on = b.getAttribute('data-snd') === cur;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  $all('#breath-sound-seg .segbtn, #privacy-sound-seg .segbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      prefs.breathSound = b.getAttribute('data-snd');
      savePrefs(); renderSoundSegs();
      var mode = prefs.breathSound;
      if (mode === 'chimes' || mode === 'both') { ensureAudio(); chime(523.25, 0.6, 0.08); } // confirm the chimes are on
      if ((mode === 'ambient' || mode === 'both') && $('screen-breathe').classList.contains('active')) { ambientStart(); }
      else { ambientStop(); }
    });
  });
  renderSoundSegs();
  function eraseAll() {
    if (!window.confirm('Erase everything I Hate Trains stored on this phone? This can\u2019t be undone.')) { return; }
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) { keys.push(localStorage.key(i)); }
      keys.forEach(function (k) { if (k.indexOf('iht_') === 0) { localStorage.removeItem(k); } });
    } catch (e) {}
    window.location.reload();
  }
  $('btn-erase').addEventListener('click', eraseAll);
  $('btn-erase-2').addEventListener('click', eraseAll);

  /* ---------- gesture calming tools: pure touchmove math, zero dependencies, offline.
     Big forgiving zones for a shaking train. Every tool has a tap fallback for reduced motion. ---------- */
  function gestureDone(id) { $(id).addEventListener('click', function () { tick(); go(gestureReturn); }); }
  gestureDone('btn-sb-done'); gestureDone('btn-trace-done'); gestureDone('btn-hold-done');

  /* swipe breathing: the gesture IS the pacer */
  (function () {
    var zone = $('sb-zone'), fill = $('sb-fill'), word = $('sb-word');
    if (!zone) { return; }
    var lastY = null, fillP = 0, phase = '', tapUp = true, swiped = false;
    function setPhase(p) {
      if (p === phase) { return; }
      phase = p;
      word.textContent = p === 'in' ? 'Breathe in' : 'Breathe out';
      var mode = prefs.breathSound || 'chimes';
      if (mode === 'chimes' || mode === 'both') { ensureAudio(); phaseCue(p); }
    }
    function setFill(p) { fillP = Math.max(0, Math.min(1, p)); fill.style.height = (fillP * 100) + '%'; }
    zone.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) { lastY = e.touches[0].clientY; swiped = false; }
    }, { passive: true });
    zone.addEventListener('touchmove', function (e) {
      if (lastY === null || e.touches.length !== 1) { return; }
      var y = e.touches[0].clientY;
      var dy = lastY - y; // up = positive
      lastY = y;
      if (Math.abs(dy) > 6) { swiped = true; }
      if (Math.abs(dy) < 2) { return; }
      if (dy > 0) { setPhase('in'); setFill(fillP + 0.025); }
      else { setPhase('out'); setFill(fillP - 0.02); }
    }, { passive: true });
    zone.addEventListener('touchend', function () { lastY = null; });
    zone.addEventListener('click', function () { // tap fallback: alternate a slow in/out
      if (swiped) { swiped = false; return; }
      setPhase(tapUp ? 'in' : 'out');
      fill.style.transition = 'height ' + (tapUp ? 4 : 6) + 's ease';
      setFill(tapUp ? 1 : 0);
      tapUp = !tapUp;
      setTimeout(function () { fill.style.transition = 'height .12s linear'; }, 6500);
    });
  })();

  /* trace calm: trace a slow circle; a ring fills as you go */
  (function () {
    var wrap = $('trace-wrap'), fg = $('trace-fg'), dot = $('trace-dot'), hint = $('trace-hint');
    if (!wrap || !fg) { return; }
    var C = 2 * Math.PI * 70;
    fg.style.strokeDasharray = String(C);
    var total = 0, prevA = null, done = false, moved = false;
    function setProgress(p) {
      p = Math.max(0, Math.min(1, p));
      fg.style.strokeDashoffset = String(C * (1 - p));
      var ang = (-90 + p * 360) * Math.PI / 180;
      dot.setAttribute('cx', String(100 + 70 * Math.cos(ang)));
      dot.setAttribute('cy', String(100 + 70 * Math.sin(ang)));
    }
    setProgress(0);
    function angleOf(t) {
      var r = wrap.getBoundingClientRect();
      var dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 28 || dist > r.width * 0.78) { return null; } // forgiving ring band
      return (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360; // 0 = top
    }
    function complete() {
      done = true;
      hint.textContent = 'Nice. Again, or rest.';
      setTimeout(function () {
        total = 0; done = false; setProgress(0);
        hint.textContent = 'One slow loop. Stop anytime — or tap to move along.';
      }, 2600);
    }
    wrap.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) { prevA = angleOf(e.touches[0]); moved = false; }
    }, { passive: true });
    wrap.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 1) { return; }
      moved = true;
      var a = angleOf(e.touches[0]);
      if (a === null || prevA === null) { prevA = a; return; }
      var d = Math.abs(a - prevA);
      d = d > 180 ? 360 - d : d; // forgiving: either direction counts
      total += d; prevA = a;
      setProgress(total / 360);
      if (total >= 360 && !done) { complete(); }
    }, { passive: true });
    wrap.addEventListener('touchend', function () { prevA = null; });
    wrap.addEventListener('click', function () { // tap fallback: quarter loops
      if (moved) { moved = false; return; }
      if (done) { return; }
      total += 90; setProgress(total / 360);
      if (total >= 360) { complete(); }
    });
  })();

  /* hold to steady: press and hold; a soft tone rises with you; let go anytime */
  (function () {
    var btn = $('hold-btn'), fillEl = $('hold-fill'), word = $('hold-word');
    if (!btn) { return; }
    var raf = null, t0 = 0, tone = null, holding = false;
    function toneStart() {
      if ((prefs.breathSound || 'chimes') === 'off') { return; }
      var ctx = ensureAudio(); if (!ctx) { return; }
      try {
        var o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(196, ctx.currentTime);
        o.frequency.linearRampToValueAtTime(392, ctx.currentTime + 8); // rises with you
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 1.5);
        o.connect(g); g.connect(ctx.destination); o.start();
        tone = { o: o, g: g, ctx: ctx };
      } catch (e) {}
    }
    function toneStop() {
      var h = tone; tone = null;
      if (!h) { return; }
      try {
        h.g.gain.cancelScheduledValues(h.ctx.currentTime);
        h.g.gain.setValueAtTime(Math.max(h.g.gain.value, 0.0001), h.ctx.currentTime);
        h.g.gain.exponentialRampToValueAtTime(0.0001, h.ctx.currentTime + 0.4);
        setTimeout(function () { try { h.o.stop(); } catch (e) {} }, 500);
      } catch (e) {}
    }
    function start() {
      if (holding) { return; }
      holding = true;
      t0 = performance.now();
      toneStart();
      cancelAnimationFrame(raf);
      var step = function () {
        var p = Math.min(1, (performance.now() - t0) / 8000);
        fillEl.style.transform = 'scale(' + (0.2 + 0.8 * p) + ')';
        word.textContent = p >= 1 ? 'Steady. Let go whenever.' : 'Keep holding…';
        if (p < 1 && holding) { raf = requestAnimationFrame(step); }
      };
      step();
    }
    function end() {
      if (!holding) { return; }
      holding = false;
      cancelAnimationFrame(raf);
      toneStop();
      fillEl.style.transform = 'scale(0.2)';
      word.textContent = 'Press and hold';
    }
    btn.addEventListener('touchstart', start, { passive: true });
    btn.addEventListener('touchend', end);
    btn.addEventListener('touchcancel', end);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  })();

  /* ---------- first-time walkthrough: 3-4 steps, skippable, shows once.
     Assume the rider knows nothing. This is the "nobody else will understand" fix. ---------- */
  var TOUR_STEPS = [
    { title: 'SOS is always one tap away.', body: 'The red SOS button follows you on every screen. Tap it any time you need help — no setup, no questions first.' },
    { title: 'Start a ride when you board.', body: 'Say how you feel, run the 30-second prep, then tap once per stop. That\u2019s the whole job.' },
    { title: 'The toolkit is your calm shelf.', body: 'Breathing, grounding, touch tools, comfort — everything works offline, even in a tunnel.' },
    { title: 'Set your backup plan once.', body: 'Exits, people to reach, things that help. Set it while you\u2019re calm — it\u2019s there when you\u2019re not.' }
  ];
  var tourIdx = 0, tourReturn = 'screen-home';
  function startTour(returnTo) {
    tourReturn = returnTo || 'screen-home';
    tourIdx = 0;
    renderTour(); tick(); go('screen-tour');
  }
  function renderTour() {
    var n = TOUR_STEPS.length;
    $('tour-count').textContent = (tourIdx + 1) + ' of ' + n;
    $('tour-title').textContent = TOUR_STEPS[tourIdx].title;
    $('tour-body').textContent = TOUR_STEPS[tourIdx].body;
    $('btn-tour-next').textContent = tourIdx === n - 1 ? 'Got it — take me in' : 'Next';
  }
  function endTour() { try { localStorage.setItem('iht_toured', '1'); } catch (e) {} tick(); go(tourReturn); }
  $('btn-tour-next').addEventListener('click', function () {
    if (tourIdx < TOUR_STEPS.length - 1) { tourIdx++; renderTour(); tick(); }
    else { endTour(); }
  });
  $('btn-tour-skip').addEventListener('click', endTour);
  $('btn-replay-tour').addEventListener('click', function () { startTour('screen-about'); });

  /* ---------- boot: onboarding first, then the tour, then home ---------- */
  applyProfileToHome();
  if (!read('iht_onboarded')) { go('screen-ob1'); }
  else if (!read('iht_toured')) { startTour('screen-home'); }
  else { updateSosFloat('screen-home'); }

})();
