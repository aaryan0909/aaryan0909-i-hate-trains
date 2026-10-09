/* I Hate Trains — v12. Free forever. Feel-first, quality over quantity. Offline-first: no network in core flows. */
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
    if (coachVisible) { coachHide(); } // navigating dismisses the hint (it returns next visit)
    $all('.screen').forEach(function (s) { s.classList.remove('active'); });
    var el = $(id);
    if (el) { el.classList.add('active'); window.scrollTo(0, 0); }
    if (id !== 'screen-breathe') { stopBreathe(); } // leaving the exercise always stops it cleanly
    stopHold(); stopMuscleHold(); // never leave a hold tone or rAF loop running on a hidden screen
    if (id === 'screen-butterfly') { flyReset(); }
    updateSosFloat(id);
    maybeCoach(id);
    if (id === 'screen-panic') { renderLastHelped(); } // journal read-back, one card, calm
  }
  function navGoBack() { var p = navBack.pop(); if (!p) { return; } navFwd.push(currentScreen()); tick(); go(p, { keep: true }); }
  function navGoFwd() { var n = navFwd.pop(); if (!n) { return; } var c = currentScreen(); if (c) { navBack.push(c); } tick(); go(n, { keep: true }); }
  /* swipe navigation: right = back, left = forward. Gesture zones are namespaced — swipes starting
     inside interactive tool zones, inputs, or buttons never navigate. */
  var swipeStart = null;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { swipeStart = null; return; }
    var t = e.target;
    if (t && t.closest && t.closest('.swipezone, .tracewrap, .holdbtn, .petsheet, input, textarea, select, button, a')) { swipeStart = null; return; }
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
  /* SOS stays one tap away on every screen except home (has the big button), the panic flow itself, and onboarding (each onboarding screen carries its own "I need help right now" escape straight to help) */
  var SOS_HIDDEN = { 'screen-home': 1, 'screen-panic': 1, 'screen-breathe': 1, 'screen-ob1': 1, 'screen-ob2': 1, 'screen-ob3': 1, 'screen-ob4': 1, 'screen-ob5': 1 };
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
    { id: 'five-senses', vis: 'tvis-senses', title: '5–4–3–2–1 senses', cat: 'ground', time: 'A few minutes', fn: 'senses',
      summary: 'Tap a dot for each thing you notice — see, feel, hear, smell, taste.',
      steps: ['Name five things you can see, noticing color or shape.', 'Notice four things you can feel: your feet, fabric, a cool surface, or your hands.', 'Listen for three sounds. They can be quiet or ordinary.', 'Notice two smells, or two neutral details if smells are hard to notice.', 'Notice one taste, or the feeling of your mouth. You can skip any sense.'] },
    { id: 'three-three-three', vis: 'tvis-333', title: '3–3–3 noticing', cat: 'ground', time: 'About a minute',
      summary: 'A shorter sensory route that does not ask you to change your breathing.',
      steps: ['Find three things you can see.', 'Find three things you can hear.', 'Notice three physical sensations where your body meets the seat, floor, or clothing.'] },
    { id: 'object-detail', vis: 'tvis-object', title: 'One-object details', cat: 'ground', time: '30 seconds or more',
      summary: 'Pick one nearby object and let its details hold your attention.',
      steps: ['Choose an object you can see, such as a sign, shoe, or window edge.', 'Notice its outline, colors, texture, and the way light falls on it.', 'If your mind wanders, simply return to one detail. Nothing to get right.'] },
    { id: 'safe-place', vis: 'tvis-safe', title: 'A familiar safe place', cat: 'ground', time: 'About a minute',
      summary: 'Picture somewhere familiar or imagined that feels comforting enough.',
      steps: ['Bring to mind a real or imagined place you like.', 'Notice one color, one sound, and one texture from that place.', 'You do not need to feel calm or finish the image. Return to the carriage whenever you want.'] },
    { id: 'med-body-scan', vis: 'tvis-scan', title: 'One-minute body scan', cat: 'ground', time: 'About a minute',
      summary: 'Move attention slowly through the body. Notice — don\u2019t fix.',
      steps: ['Rest your attention on the top of your head. Notice any sensation, or none at all.', 'Let it drift down to your shoulders. If they\u2019re tight, you don\u2019t have to change it — just notice.', 'Move to your hands. Feel their weight, warmth, or stillness.', 'Down to your feet on the floor. Notice the support under you.', 'That\u2019s it. You can stop here, or run it again.'],
      safety: 'This is a coping tool, not treatment. Stop any time.' },
    { id: 'med-kind-wishes', vis: 'tvis-wish', title: 'Warm wishes', cat: 'ground', time: 'About a minute',
      summary: 'Three quiet phrases — first for you, then for someone you love.',
      steps: ['Silently, to yourself: \u201CMay I be steady.\u201D', 'Again, gently: \u201CMay I be safe.\u201D', 'Now picture someone you love: \u201CMay you be steady. May you be safe.\u201D', 'That\u2019s enough. Warmth counts, even if you don\u2019t feel it yet.'],
      safety: 'This is a coping tool, not treatment. Stop any time.' },
    { id: 'med-sounds', vis: 'tvis-sound', title: 'Sounds around you', cat: 'ground', time: 'About a minute',
      summary: 'Let the train\u2019s noise become the object — not the enemy.',
      steps: ['Notice the nearest sound to you. Just name it silently.', 'Now find the farthest sound you can hear.', 'Pick one sound in between and rest your attention there.', 'The noise isn\u2019t the enemy here. It\u2019s just sound, passing through.'],
      safety: 'This is a coping tool, not treatment. Stop any time.' },
    { id: 'swipe-breathe', vis: 'tvis-swipe', title: 'Swipe breathing', cat: 'touch', time: 'As long as you like', screen: 'screen-swipebreathe',
      summary: 'The gesture is the pacer: swipe up slowly to breathe in, down to breathe out.' },
    { id: 'trace-calm', vis: 'tvis-trace', title: 'Trace calm', cat: 'touch', time: 'About a minute', screen: 'screen-trace',
      summary: 'Trace a slow circle with your finger. A ring fills as you go.' },
    { id: 'hold-steady', vis: 'tvis-hold', title: 'Hold to steady', cat: 'touch', time: 'As long as you like', screen: 'screen-hold',
      summary: 'Press and hold. A soft tone rises with you. Let go anytime.' },
    { id: 'muscle-release', vis: 'tvis-muscle', title: 'Progressive muscle release', cat: 'ground', time: 'About a minute', fn: 'muscle',
      summary: 'Hold to tense, release to let go — hands, shoulders, jaw. Skip anything uncomfortable.',
      steps: ['Let your hands rest. If comfortable, press your fingertips together gently for a moment, then release.', 'If it feels okay, lift your shoulders just a little without straining, then let them drop.', 'Optionally soften your jaw or face; skip this if it is uncomfortable.', 'Notice the support beneath you. Keep breathing however it happens naturally — this tool does not ask you to change your breath.'],
      safety: 'Do not tense around an injury or painful area. Stop any movement that hurts or feels unsafe; you can skip the movement and simply notice the chair supporting you.' },
    { id: 'kind-words', vis: 'tvis-words', title: 'Kind, factual words', cat: 'ground', time: 'A few seconds', fn: 'kindwords',
      summary: 'A deck of believable lines — tap through, keep what lands.',
      steps: ['Try: This is a hard moment, and I can choose one small next step.', 'Or: I am allowed to ask someone for support.', 'Or use your own words. You do not have to feel reassured for this to count.'] },
    { id: 'breath-box', vis: 'tvis-breath', title: 'Even square breathing', cat: 'breath', time: 'Three gentle cycles', pattern: 'box',
      summary: 'An optional paced-breathing exercise with even sides.',
      steps: ['Choose this only if paying attention to breathing feels okay.', 'Let the cues guide a gentle in-breath, a comfortable pause, a gentle out-breath, and a comfortable rest.', 'You can stop or switch to grounding at any point.'],
      safety: 'Breathing practices are optional coping tools, not treatment. Stop immediately if breathing feels difficult or uncomfortable; switch to a non-breath grounding tool.' },
    { id: 'breath-478', vis: 'tvis-478', title: '4–7–8 breathing', cat: 'breath', time: 'Two gentle cycles', pattern: '478',
      summary: 'A longer, unhurried out-breath. The pause is optional.',
      steps: ['Choose this only if it feels comfortable to focus on breathing.', 'Breathe in gently for about four seconds. Pause for up to seven only if comfortable.', 'Breathe out gently for about eight seconds; do not force the breath or hold it if that feels wrong.'],
      safety: 'Stop immediately if breathing feels difficult or uncomfortable. Switch to grounding or another non-breath option.' },
    { id: 'breath-sigh', vis: 'tvis-sigh', title: 'Cyclic sigh (optional)', cat: 'breath', time: 'One comfortable round',
      summary: 'A comfortable inhale, a smaller second inhale, then a slow, easy out-breath. Untimed — go at your pace.',
      steps: ['Let a comfortable inhale happen through your nose if possible.', 'At the top, add a small second inhale only if that feels okay.', 'Let the air out slowly without forcing it. No breath hold or fixed pace is required. Repeat only if you want.'],
      safety: 'A 2023 study found mood and breathing-rate effects with daily cyclic sigh practice, but this is not evidence that it treats panic attacks. Stop if it feels uncomfortable and switch tools.' },
    { id: 'panic-facts', vis: 'tvis-facts', title: 'What panic can feel like', cat: 'understand', time: 'A short read',
      summary: 'A calm, factual reminder. This cannot tell you what is causing your symptoms.',
      steps: ['Panic can bring intense fear and physical sensations such as a pounding heart, dizziness, trembling, tingling, or breathing discomfort.', 'These sensations can be frightening. A panic response can rise and change over time; you do not have to solve it all at once.', 'An app cannot diagnose you. If symptoms are new, severe, or medically concerning, seek urgent medical help.'] },
    { id: 'thought-check', vis: 'tvis-thought', title: 'A gentle thought check', cat: 'understand', time: 'A minute or two', fn: 'thought',
      summary: 'Write the scary thought out, then meet it with facts. Stays on your phone.',
      steps: ['Name the scary thought in a few words, without arguing with yourself.', 'Ask: what do I know for sure right now, and what is my fear predicting?', 'Offer one kinder, more balanced possibility: I can take one step and reassess.', 'This is a self-help prompt, not a substitute for CBT or professional care.'] },
    { id: 'categories', vis: 'tvis-cats', title: 'Quiet category game', cat: 'distract', time: 'As long as you like', fn: 'categories',
      summary: 'Pick a category, name things, watch the list grow. No scoring, no rush.',
      steps: ['Choose a category you enjoy: foods, films, animals, plants, or places.', 'Think of one item at a time, at your own pace.', 'Change categories whenever you want. You can stop without finishing.'] },
    { id: 'backwards-count', vis: 'tvis-count', title: 'Count backward', cat: 'distract', time: 'As long as you like', fn: 'countdown',
      summary: 'Pick a number, tap it down. A silent attention exercise.',
      steps: ['Start anywhere that feels easy, such as 20 or 10.', 'Count backward by ones, or skip this and pick another option.', 'No need to be exact; switch tools if this starts to feel frustrating.'] },
    { id: 'butterfly-hug', vis: 'tvis-flap', title: 'Butterfly taps', cat: 'touch', time: 'About a minute', screen: 'screen-butterfly',
      summary: 'Alternate left-right taps, slow and steady — a phone-friendly take on a classic calming technique.' },
    { id: 'ride-plan', vis: 'tvis-plan', title: 'My ride backup plan', cat: 'plan', time: 'Before boarding', goto: 'screen-plan',
      summary: 'Make a small plan while you have more headspace; no live transit data is used.', steps: [] },
    { id: 'confidence-ladder', vis: 'tvis-ladder', title: 'Gentle confidence practice', cat: 'plan', time: 'Only when ready, before a ride', goto: 'screen-plan',
      summary: 'A private, gradual practice planner inspired by exposure principles — not a challenge.',
      steps: ['Choose a small practice that feels manageable and safe to you, or decide with a clinician.', 'You may pause, change plans, or leave at any time. No streak, score, or penalty.', 'Exposure-based CBT is treatment delivered with appropriate guidance; this planner is not therapy.'] },
    { id: 'post-ride', vis: 'tvis-reflect', title: 'After-ride reflection', cat: 'reflect', time: 'Optional, about 30 seconds', goto: 'screen-reflect',
      summary: 'Notice what happened and what helped, without judging how the ride went.', steps: [] }
  ];
  function getTool(id) { for (var i = 0; i < TOOLS.length; i++) { if (TOOLS[i].id === id) { return TOOLS[i]; } } return null; }
  var NONBREATH_IDS = ['object-detail', 'muscle-release', 'safe-place', 'kind-words', 'categories', 'trace-calm', 'hold-steady', 'butterfly-hug', 'med-body-scan', 'med-kind-wishes', 'med-sounds'];

  /* ---------- tool walkthrough (generic, paced, calm) ---------- */
  var walkReturn = 'screen-home', walkTool = null, walkIdx = 0;
  var gestureReturn = 'screen-home';
  function openTool(id, returnTo) {
    var t = getTool(id);
    if (!t) { return; }
    if (t.screen) { gestureReturn = returnTo || 'screen-home'; tick(); go(t.screen); return; }
    if (t.goto) { if (t.goto === 'screen-plan') { planReturn = returnTo || 'screen-home'; } tick(); go(t.goto); return; }
    if (t.fn && TOOL_FNS[t.fn]) { TOOL_FNS[t.fn](returnTo || 'screen-home'); return; } // interactive tools: experiential, not reading
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
  /* living mini-visual per tool: the icon-card language. Every card gets one. */
  var VIS_N = { 'tvis-swipe': 1, 'tvis-trace': 1, 'tvis-hold': 1, 'tvis-flap': 2, 'tvis-senses': 5, 'tvis-cats': 3,
    'tvis-333': 3, 'tvis-object': 1, 'tvis-safe': 1, 'tvis-breath': 1, 'tvis-478': 1, 'tvis-sigh': 2, 'tvis-facts': 1,
    'tvis-thought': 2, 'tvis-count': 3, 'tvis-plan': 3, 'tvis-ladder': 3, 'tvis-reflect': 1, 'tvis-muscle': 2,
    'tvis-words': 3, 'tvis-scan': 1, 'tvis-wish': 2, 'tvis-sound': 3, 'tvis-cute': 4 };
  function toolVisual(t) {
    if (!t.vis) { return null; }
    var vis = document.createElement('span');
    vis.className = 'tvis ' + t.vis;
    vis.setAttribute('aria-hidden', 'true');
    var n = VIS_N[t.vis] || 1;
    for (var i = 0; i < n; i++) {
      var d = document.createElement('i');
      if (t.vis === 'tvis-flap') { d.className = i === 0 ? 'l' : 'r'; }
      vis.appendChild(d);
    }
    return vis;
  }
  function toolCard(t, returnTo) {
    var b = document.createElement('button');
    b.className = 'toolcard';
    var v = toolVisual(t);
    if (v) { b.appendChild(v); }
    var title = document.createElement('strong'); title.textContent = t.title;
    var meta = document.createElement('div'); meta.className = 'tmeta'; meta.textContent = (CAT_LABEL[t.cat] || '') + ' · ' + t.time;
    var sum = document.createElement('p'); sum.textContent = t.summary;
    b.appendChild(title); b.appendChild(meta); b.appendChild(sum);
    b.addEventListener('click', function () {
      if (t.pattern) { startBreathe(t.pattern, returnTo, false); }
      else { openTool(t.id, returnTo); }
    });
    return b;
  }
  /* featured hands-on row: the most experiential tools. Visuals come from each tool's own vis. */
  var FEATURED = ['swipe-breathe', 'trace-calm', 'hold-steady', 'butterfly-hug', 'five-senses', 'categories'];
  var FEATURED_IDS = FEATURED.slice();
  (function renderFeatured() {
    var host = $('toolkit-featured');
    if (!host) { return; }
    FEATURED.forEach(function (id) {
      var t = getTool(id);
      if (!t) { return; }
      var b = document.createElement('button'); b.className = 'toolcard feat';
      var v = toolVisual(t);
      if (v) { b.appendChild(v); }
      var title = document.createElement('strong'); title.textContent = t.title;
      var sum = document.createElement('p'); sum.textContent = t.summary;
      b.appendChild(title); b.appendChild(sum);
      b.addEventListener('click', function () { openTool(t.id, 'screen-toolkit'); });
      host.appendChild(b);
    });
  })();
  (function renderToolkit() {
    var host = $('toolkit-groups');
    var order = ['ground', 'breath', 'distract', 'understand', 'plan', 'reflect'];
    order.forEach(function (cat) {
      var items = TOOLS.filter(function (t) { return t.cat === cat && FEATURED_IDS.indexOf(t.id) === -1; });
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
    var v = toolVisual({ vis: 'tvis-cute' });
    if (v) { b.appendChild(v); }
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
    var MINI_VIS = { 'med-body-scan': 'mv-scan', 'med-kind-wishes': 'mv-wish', 'med-sounds': 'mv-sound' };
    var MINI_N = { 'mv-scan': 1, 'mv-wish': 2, 'mv-sound': 3 };
    ['med-body-scan', 'med-kind-wishes', 'med-sounds'].forEach(function (id) {
      var t = getTool(id);
      if (!t) { return; }
      var b = document.createElement('button'); b.className = 'linkcard';
      var mv = document.createElement('span'); mv.className = 'mv ' + MINI_VIS[id]; mv.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < MINI_N[MINI_VIS[id]]; i++) { mv.appendChild(document.createElement('i')); }
      var label = document.createElement('span');
      var st = document.createElement('strong'); st.textContent = t.title;
      var em = document.createElement('span'); em.className = 'body'; em.textContent = t.time;
      label.appendChild(st); label.appendChild(document.createElement('br')); label.appendChild(em);
      var go2 = document.createElement('span'); go2.className = 'go'; go2.textContent = '\u2192';
      b.appendChild(mv); b.appendChild(label); b.appendChild(go2);
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
  var breathTimer = null, breathSwap = null, breatheReturn = 'screen-home';
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
    if (breathSwap) { clearTimeout(breathSwap); }
    breathSwap = setTimeout(function () {
      breathSwap = null;
      word.textContent = p.word;
      cap.textContent = p.cap;
      cap.classList.remove('swap');
    }, 200);
    var c = $('breath-circle');
    var grow = (p.k === 'in');
    c.style.transition = 'transform ' + p.secs + 's cubic-bezier(.37,0,.63,1)';
    void c.offsetWidth;
    c.style.transform = 'scale(' + (grow ? 1.32 : 1) + ')'; // the bloom opens and folds with the breath
    var pb = $('pet-breathe'); // v12: the co-rider breathes with you, in sync
    if (pb) {
      pb.style.transition = 'transform ' + p.secs + 's cubic-bezier(.37,0,.63,1)';
      pb.style.transform = 'scale(' + (grow ? 1.14 : 1) + ')';
    }
    breathHaptic(p.k);
    phaseCue(p.k);
    breathTimer = setTimeout(function () { runPhase(phases, i + 1); }, p.secs * 1000);
  }
  /* the co-rider breathes with you: caption names the companion so the moment is unmistakable */
  function renderBreatheCap() {
    var cap = $('pet-breathe-cap');
    if (cap) { cap.textContent = (pet.name || 'Mochi') + ' breathes with you'; }
  }
  function startBreathe(pattern, returnTo, minimal) {
    breatheReturn = returnTo || 'screen-home';
    stopBreathe();
    ensureAudio(); // first user gesture: safe to init audio on iOS
    petInto($('pet-breathe'), 'sleepy'); // the co-rider gets sleepy too
    renderBreatheCap();
    setBreathPattern(pattern || 'gentle');
    $('breath-patterns').classList.toggle('hidden', !!minimal);
    var c = $('breath-circle');
    c.style.transition = 'none';
    c.style.transform = 'scale(1)';
    var pb0 = $('pet-breathe');
    if (pb0) { pb0.style.transition = 'none'; pb0.style.transform = 'scale(1)'; }
    tick(); go('screen-breathe');
    var mode = prefs.breathSound || 'chimes';
    if (mode === 'ambient' || mode === 'both') { ambientStart(); }
    runPhase(PATTERNS[breathPattern].phases, 0); // no gate: the exercise starts NOW
  }
  function stopBreathe() { if (breathTimer) { clearTimeout(breathTimer); breathTimer = null; } if (breathSwap) { clearTimeout(breathSwap); breathSwap = null; } ambientStop(); }
  var stopHold = function () {}; // replaced by the hold-to-steady tool below; go() calls it so a mid-hold navigation never leaves the tone droning
  var stopMuscleHold = function () {}; // replaced by the muscle-release hold ring below (same reason: never leave a rAF loop running on a hidden screen)
  $('btn-breathe-end').addEventListener('click', function () { tick(); stopBreathe(); go(breatheReturn); });

  /* panic entry: minimal sacred flow */
  $('btn-panic-breathe').addEventListener('click', function () { startBreathe('gentle', 'screen-panic', true); });
  $('btn-panic-ground').addEventListener('click', function () { openTool('five-senses', 'screen-panic'); });

  /* "what helped last time": the reflection journal (iht_journal, on-device, capped
     at 100) is write-only today; read the most recent entry back on the panic
     screen as one calm, personal suggestion. Nothing leaves the phone. Wrapped so
     a corrupt journal can never break the sacred flow. */
  var lastHelpTool = null;
  function toolByTitle(title) {
    for (var i = 0; i < TOOLS.length; i++) { if (TOOLS[i].title === title) { return TOOLS[i]; } }
    return null;
  }
  function renderLastHelped() {
    var card = $('panic-lasthelp');
    if (!card) { return; }
    lastHelpTool = null;
    try {
      var log = readJSON('iht_journal', []);
      for (var i = log.length - 1; i >= 0; i--) {
        var e = log[i] || {};
        if (e.tools && e.tools.length) {
          var t = toolByTitle(e.tools[0]);
          if (t) { lastHelpTool = t; break; }
        }
      }
    } catch (err) { lastHelpTool = null; }
    if (!lastHelpTool) { card.hidden = true; return; }
    $('lasthelp-text').textContent = 'Last ride, ' + lastHelpTool.title + ' helped. Want to start there?';
    $('btn-lasthelp').textContent = 'Start ' + lastHelpTool.title;
    card.hidden = false;
  }
  $('btn-lasthelp').addEventListener('click', function () {
    tick();
    if (lastHelpTool) { openTool(lastHelpTool.id, 'screen-panic'); }
  });

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
      petMood = checkinFeel === 'spiraling' ? 'soft' : null; // v12: the co-rider notices how you feel
      renderHomePet();
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
    }, function (err) {
      clearTimeout(timer);
      var code = err && err.code;
      if (code === 1) {
        /* PERMISSION_DENIED: she said no, or Location Services are off. Never blame; guide. */
        fail('Location permission is off. Turn it on in Settings \u2192 Privacy & Security \u2192 Location Services \u2192 Safari Websites — or just fill in below, no pressure.');
      } else if (code === 2) {
        /* POSITION_UNAVAILABLE */
        fail('Couldn\u2019t get a location fix. Enter it below — takes a few seconds.');
      } else {
        /* TIMEOUT (3) or unknown: the underground case */
        fail('No GPS fix — totally normal underground. Tell us your ride below.');
      }
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
    petInto($('pet-arrived'), 'celebrate'); // you made it — so did they
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
    petInto($('pet-trip'), 'idle'); // the co-rider rides along
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
    var wasCalmer = reflectAfter === 'calmer';
    try {
      var log = readJSON('iht_journal', []);
      log.push({ t: new Date().toISOString(), before: checkinFeel, after: reflectAfter, tools: reflectTools.slice(), note: $('in-reflect').value.trim().slice(0, 280) });
      store('iht_journal', JSON.stringify(log.slice(-100)));
    } catch (e) {}
    try { store('iht_trips', String((parseInt(read('iht_trips') || '0', 10) || 0) + 1)); } catch (e) {}
    checkinFeel = null; reflectAfter = null; reflectTools = [];
    tripActive = false;
    if (wasCalmer) { petMood = 'proud'; } // v12: the co-rider is proud of you
    applyTheme();
    renderHomePet();
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
  /* YouTube is the default AND the recommended platform: works logged-out, most reliable. */
  var SOCIAL_PLAT = read('iht_social_plat') || 'yt';
  var SOCIAL_CAP = {
    yt: 'YouTube recommended — works without logging in.',
    tt: 'TikTok search — usually fine without logging in.',
    ig: 'Opens Instagram Explore. (Instagram needs a login for more.)'
  };
  var SOCIAL_CATS = [
    { id: 'puppies', title: 'Puppies', emoji: '\uD83D\uDC36', q: 'cute puppies compilation' },
    { id: 'kittens', title: 'Kittens', emoji: '\uD83D\uDC31', q: 'cute kittens compilation' },
    { id: 'babies', title: 'Baby animals', emoji: '\uD83D\uDC23', q: 'cute baby animals compilation' },
    { id: 'funny', title: 'Something funny', emoji: '\uD83D\uDE02', q: 'funny animal videos' },
    { id: 'nature', title: 'Calm nature', emoji: '\uD83C\uDF3F', q: 'relaxing nature 4k' }
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
  function renderSocialSeg() {
    $all('#social-seg .segbtn').forEach(function (x) {
      var on = x.getAttribute('data-plat') === SOCIAL_PLAT;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var cap = $('social-cap');
    if (cap) { cap.textContent = SOCIAL_CAP[SOCIAL_PLAT] || SOCIAL_CAP.yt; }
  }
  $all('#social-seg .segbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      SOCIAL_PLAT = b.getAttribute('data-plat');
      store('iht_social_plat', SOCIAL_PLAT);
      renderSocialSeg();
    });
  });
  renderSocialSeg();
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

  /* onboarding: persistent crisis escape — one tap skips setup (defaults kept) and opens help */
  $all('[data-ob-escape]').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      try { localStorage.setItem('iht_onboarded', '1'); } catch (e) {}
      go('screen-panic');
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
  $('btn-ob4-next').addEventListener('click', function () {
    tick();
    var v = ($('ob-comfort-url').value || '').trim();
    if (v && /^https?:\/\//i.test(v)) { store('iht_comfort_one', v); }
    petPreviewOb();
    go('screen-ob5');
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
    stopHold = end; // navigating away mid-hold stops the tone + animation (see go())
  })();

  /* ---------- the old full-screen tour is gone: contextual coach marks replace it (see boot block) ---------- */

  /* ============ v10: THE PET — a co-rider. Zero maintenance: no meters, no death, no guilt. Ever. ============ */
  var PET_DEFAULTS = { blob: 'Mochi', bird: 'Pip', cat: 'Miso' };
  var pet = readJSON('iht_pet', null) || { type: 'blob', name: 'Mochi' };
  function savePet() { store('iht_pet', JSON.stringify(pet)); }
  function petSVG(type) {
    var eyeOpen = '<g class="peye peye-open"><circle cx="48" cy="62" r="5.5" fill="#10141b"/><circle cx="72" cy="62" r="5.5" fill="#10141b"/><circle cx="50" cy="60" r="1.8" fill="#fff"/><circle cx="74" cy="60" r="1.8" fill="#fff"/></g>';
    var eyeShut = '<g class="peye-shut"><path d="M42 62 q6 5 12 0 M66 62 q6 5 12 0" stroke="#10141b" stroke-width="3" fill="none" stroke-linecap="round"/></g>';
    var blush = '<ellipse cx="37" cy="72" rx="5" ry="3.5" fill="#d98a9e" opacity=".55"/><ellipse cx="83" cy="72" rx="5" ry="3.5" fill="#d98a9e" opacity=".55"/>';
    if (type === 'bird') {
      return '<svg viewBox="0 0 120 120" class="petsvg" aria-hidden="true">'
        + '<path d="M30 78 q-16 4 -20 18 q16 2 24 -8 Z" fill="#8a96cc"/>'
        + '<circle cx="60" cy="66" r="30" fill="#a9b6e8"/>'
        + '<ellipse cx="42" cy="70" rx="11" ry="17" fill="#8a96cc" transform="rotate(14 42 70)"/>'
        + '<ellipse cx="50" cy="52" rx="9" ry="12" fill="#ffffff" opacity=".18" transform="rotate(-16 50 52)"/>'
        + '<path d="M60 62 l13 5 l-13 5 Z" fill="#e8b86f"/>'
        + '<g class="peye peye-open"><circle cx="70" cy="52" r="5.5" fill="#10141b"/><circle cx="72" cy="50" r="1.8" fill="#fff"/></g>'
        + '<g class="peye-shut"><path d="M64 52 q6 5 12 0" stroke="#10141b" stroke-width="3" fill="none" stroke-linecap="round"/></g>'
        + '<ellipse cx="60" cy="62" rx="5" ry="3.5" fill="#d98a9e" opacity=".55"/>'
        + '<path d="M52 94 l0 9 M68 94 l0 9" stroke="#e8b86f" stroke-width="3" stroke-linecap="round"/></svg>';
    }
    if (type === 'cat') {
      return '<svg viewBox="0 0 120 120" class="petsvg" aria-hidden="true">'
        + '<path d="M90 86 q18 -2 22 -20" stroke="#e8b86f" stroke-width="9" fill="none" stroke-linecap="round"/>'
        + '<path d="M34 42 L27 16 L49 30 Z" fill="#e8b86f"/><path d="M86 42 L93 16 L71 30 Z" fill="#e8b86f"/>'
        + '<path d="M36 35 L31 21 L45 30 Z" fill="#d9a05f"/><path d="M84 35 L89 21 L75 30 Z" fill="#d9a05f"/>'
        + '<circle cx="60" cy="64" r="30" fill="#e8b86f"/>'
        + '<path d="M48 40 q3 5 0 10 M60 38 q3 5 0 10 M72 40 q3 5 0 10" stroke="#d9a05f" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
        + eyeOpen + eyeShut + blush
        + '<path d="M56 74 h8 l-4 5 Z" fill="#d98a9e"/>'
        + '<path d="M30 66 l-15 -3 M30 73 l-15 3 M90 66 l15 -3 M90 73 l15 3" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".7"/></svg>';
    }
    return '<svg viewBox="0 0 120 120" class="petsvg" aria-hidden="true">'
      + '<ellipse cx="60" cy="104" rx="30" ry="7" fill="rgba(0,0,0,.28)"/>'
      + '<path d="M60 22 C36 22 26 44 26 66 C26 90 40 100 60 100 C80 100 94 90 94 66 C94 44 84 22 60 22 Z" fill="#93d3ab"/>'
      + '<ellipse cx="45" cy="46" rx="10" ry="15" fill="#ffffff" opacity=".16" transform="rotate(-18 45 46)"/>'
      + eyeOpen + eyeShut + blush
      + '<path d="M54 76 q6 5 12 0" stroke="#10141b" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>';
  }
  function petInto(el, mode, forceType) {
    if (!el) { return; }
    el.innerHTML = petSVG(forceType || pet.type);
    var wrap = (el.closest && el.closest('.pethome,.petstage,.pettrip,.petbreathe,.petarrived,.petprev,.petcomfort,.ps-pet')) || el;
    wrap.classList.remove('pet-idle', 'pet-happy', 'pet-celebrate', 'pet-sleepy');
    wrap.classList.add(mode === 'sleepy' ? 'pet-sleepy' : mode === 'celebrate' ? 'pet-celebrate' : 'pet-idle');
  }
  function petHearts(el, n) {
    for (var i = 0; i < (n || 3); i++) {
      (function (i) {
        setTimeout(function () {
          var h = document.createElement('span');
          h.className = 'heart'; h.textContent = '\u2665';
          h.style.setProperty('--hx', ((i - 1) * 26 + (Math.random() * 14 - 7)) + 'px');
          h.style.left = (40 + i * 10) + '%';
          el.appendChild(h);
          setTimeout(function () { if (h.parentNode) { h.parentNode.removeChild(h); } }, 1350);
        }, i * 170);
      })(i);
    }
  }
  function petTap(el) {
    tick();
    var wrap = (el.closest && el.closest('.pethome,.petstage,.ps-pet')) || el;
    wrap.classList.remove('pet-happy'); void wrap.offsetWidth; wrap.classList.add('pet-happy');
    petHearts(wrap, 3);
    try { ensureAudio(); chime(880, 0.5, 0.045); } catch (e) {}
    setTimeout(function () { wrap.classList.remove('pet-happy'); }, 700);
  }
  function renderHomePet() {
    if (!$('pet-home-svg')) { return; }
    var nm = pet.name || 'Mochi';
    $('pet-home-name').textContent = nm;
    var cap = document.querySelector('#pet-home .petcap em');
    if (petMood === 'proud') {
      petInto($('pet-home-svg'), 'celebrate');
      if (cap) { cap.textContent = nm + ' is proud of you'; }
      setTimeout(function () {
        petMood = null;
        if (currentScreen() === 'screen-home') { renderHomePet(); }
      }, 2400);
    } else {
      petInto($('pet-home-svg'), 'idle');
      if (cap) { cap.textContent = petMood === 'soft' ? nm + ' is right here with you' : 'is riding with you'; }
    }
  }
  /* v12: every pet mount, refreshed together after any pet change */
  function renderPetEverywhere() {
    renderHomePet();
    petInto($('pet-trip'), 'idle');
    petInto($('pet-breathe'), 'sleepy');
    petInto($('pet-arrived'), 'celebrate');
    petInto($('pet-sheet-svg'), 'idle'); // the sheet's own preview, refreshed on type change
    mountComfortPet();
    renderPetSeg();
    renderPetComfortCard();
    renderBreatheCap();
  }
  /* pet play */
  var petPlayReturn = 'screen-home';
  var PET_LINES = [
    'leans into your hand.',
    'is very glad you\u2019re here.',
    'says the train isn\u2019t so bad with you.',
    'purrs quietly.',
    'wants you to know: you\u2019ve got this.'
  ];
  function openPetPlay(returnTo) {
    petPlayReturn = returnTo || 'screen-home';
    var nm = pet.name || 'Mochi';
    $('petplay-name').textContent = nm;
    var n2 = $('petplay-name2'); if (n2) { n2.textContent = nm; }
    petInto($('petplay-stage'), 'idle');
    $('petplay-line').textContent = 'Tap to give some love.';
    tick(); go('screen-petplay');
  }
  function petPat() {
    var st = $('petplay-stage');
    petTap(st);
    $('petplay-line').textContent = (pet.name || 'Mochi') + ' ' + PET_LINES[Math.floor(Math.random() * PET_LINES.length)];
  }
  /* onboarding: meet your co-rider */
  var obPetType = 'blob';
  function petPreviewOb() {
    petInto($('ob-pet-blob'), 'idle', 'blob');
    petInto($('ob-pet-bird'), 'idle', 'bird');
    petInto($('ob-pet-cat'), 'idle', 'cat');
  }
  $all('#ob-pet-pick .petopt').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      $all('#ob-pet-pick .petopt').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      obPetType = b.getAttribute('data-pet');
      var nm = $('ob-pet-name');
      if (!nm.value) { nm.placeholder = PET_DEFAULTS[obPetType]; }
    });
  });
  function finishOnboarding() {
    pet.type = obPetType;
    var nm = ($('ob-pet-name').value || '').trim().slice(0, 24);
    pet.name = nm || PET_DEFAULTS[obPetType];
    savePet();
    try { localStorage.setItem('iht_onboarded', '1'); } catch (e) {}
    applyProfileToHome();
    renderPetEverywhere(); // every mount, not just home — the chosen pet must appear everywhere
    go('screen-home');
  }
  $('btn-ob5-done').addEventListener('click', function () { tick(); finishOnboarding(); });
  $('btn-ob5-skip').addEventListener('click', function () { tick(); obPetType = 'blob'; var i = $('ob-pet-name'); if (i) { i.value = ''; } finishOnboarding(); });
  $('btn-ob5-back').addEventListener('click', function () { tick(); go('screen-ob4'); });
  /* About: co-rider settings */
  function renderPetSeg() {
    $all('#pet-seg .segbtn').forEach(function (b) {
      var on = b.getAttribute('data-pet') === pet.type;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var inp = $('in-pet-name');
    if (inp && document.activeElement !== inp) { inp.value = pet.name || ''; }
  }
  $all('#pet-seg .segbtn').forEach(function (b) {
    b.addEventListener('click', function () { tick(); setPetType(b.getAttribute('data-pet')); });
  });
  $('in-pet-name').addEventListener('change', function () { setPetName($('in-pet-name').value); });
  $all('[data-go="screen-about"]').forEach(function (b) { b.addEventListener('click', renderPetSeg); });
  /* tap the co-rider anywhere it appears → the pet sheet (no more buried About controls) */
  $('pet-home').addEventListener('click', function () { openPetSheet(); });
  $('pet-trip').addEventListener('click', function () { openPetSheet(); });
  $('petplay-stage').addEventListener('click', petPat);
  $('petplay-stage').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); petPat(); } });
  var ppb = $('btn-pet-pat');
  if (ppb) { ppb.addEventListener('click', petPat); }
  $('btn-petplay-done').addEventListener('click', function () { tick(); go(petPlayReturn); });
  /* comfort card: created once, label refreshed on every pet change */
  var petComfortLabel = null;
  (function mountPetComfortCard() {
    var host = $('mini-list');
    if (!host) { return; }
    var b = document.createElement('button'); b.className = 'linkcard';
    var label = document.createElement('span');
    var st = document.createElement('strong'); st.textContent = 'Play with ' + (pet.name || 'Mochi');
    var em = document.createElement('span'); em.className = 'body'; em.textContent = 'No rules. Just company.';
    label.appendChild(st); label.appendChild(document.createElement('br')); label.appendChild(em);
    var go2 = document.createElement('span'); go2.className = 'go'; go2.textContent = '\u2192';
    b.appendChild(label); b.appendChild(go2);
    b.addEventListener('click', function () { openPetPlay('screen-comfort'); });
    host.appendChild(b);
    petComfortLabel = st;
  })();
  function renderPetComfortCard() {
    if (petComfortLabel) { petComfortLabel.textContent = 'Play with ' + (pet.name || 'Mochi'); }
  }

  /* ============ v12: the pet sheet — tap the co-rider anywhere, get play / rename / change in one place.
     Zero-maintenance rule stands: no meters, no hunger, no death, no guilt. Ever. ============ */
  var petSheetReturn = 'screen-home';
  var petMood = null; // 'soft' after a spiraling check-in, 'proud' after a calmer ride — warmth only, never a meter
  function mountComfortPet() { petInto($('pet-comfort'), 'idle'); }
  ['link-comfort-home', 'tool-comfort'].forEach(function (id) {
    var el = $(id);
    if (el) { el.addEventListener('click', mountComfortPet); }
  });
  function openPetSheet() {
    petSheetReturn = currentScreen() || 'screen-home';
    var nm = pet.name || 'Mochi';
    $('pet-sheet-name').textContent = nm;
    $('ps-play-name').textContent = nm;
    $('ps-pick').textContent = nm + ' picks for me';
    petInto($('pet-sheet-svg'), 'idle');
    var inp = $('ps-name');
    if (inp && document.activeElement !== inp) { inp.value = pet.name || ''; }
    renderPsPetSeg();
    $('pet-sheet-line').textContent = 'Tap ' + nm + ' for some love.';
    $('pet-sheet-back').classList.remove('hidden');
    var sh = $('pet-sheet');
    sh.classList.remove('hidden');
    requestAnimationFrame(function () { requestAnimationFrame(function () { sh.classList.add('open'); }); });
    petTap($('pet-sheet-svg')); // a little hello
  }
  function closePetSheet() {
    var sh = $('pet-sheet');
    sh.classList.remove('open');
    setTimeout(function () { sh.classList.add('hidden'); $('pet-sheet-back').classList.add('hidden'); }, 330);
    tick();
  }
  function renderPsPetSeg() {
    $all('#ps-pet-seg .segbtn').forEach(function (b) {
      var on = b.getAttribute('data-pet') === pet.type;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function setPetType(t) {
    if (!t) { return; }
    pet.type = t;
    savePet();
    renderPsPetSeg();
    renderPetEverywhere();
  }
  function setPetName(v) {
    v = (v || '').trim().slice(0, 24);
    if (!v) { return; }
    pet.name = v;
    savePet();
    renderPetEverywhere();
    $('pet-sheet-name').textContent = v;
    $('ps-play-name').textContent = v;
    $('ps-pick').textContent = v + ' picks for me';
    $('pet-sheet-line').textContent = 'Tap ' + v + ' for some love.';
  }
  /* Mochi picks for you: a random calming tool — cute AND functional */
  var PET_PICKS = TOOLS.filter(function (t) {
    return ['ground', 'touch', 'breath', 'distract', 'understand'].indexOf(t.cat) !== -1;
  });
  function petPicks() {
    var pool = PET_PICKS.length ? PET_PICKS : TOOLS;
    var t = pool[Math.floor(Math.random() * pool.length)];
    tick();
    if (t.pattern) { startBreathe(t.pattern, petSheetReturn, false); }
    else { openTool(t.id, petSheetReturn); }
  }
  $('pet-sheet-svg').addEventListener('click', function () {
    petTap($('pet-sheet-svg'));
    var nm = pet.name || 'Mochi';
    $('pet-sheet-line').textContent = nm + ' ' + PET_LINES[Math.floor(Math.random() * PET_LINES.length)];
  });
  $('ps-play').addEventListener('click', function () { closePetSheet(); setTimeout(function () { openPetPlay(petSheetReturn); }, 140); });
  $('ps-pick').addEventListener('click', function () { closePetSheet(); setTimeout(petPicks, 140); });
  $('ps-name').addEventListener('change', function () { setPetName($('ps-name').value); });
  $all('#ps-pet-seg .segbtn').forEach(function (b) {
    b.addEventListener('click', function () { tick(); setPetType(b.getAttribute('data-pet')); });
  });
  $('ps-close').addEventListener('click', closePetSheet);
  $('pet-sheet-back').addEventListener('click', closePetSheet);
  $('pet-comfort').addEventListener('click', function () { openPetSheet(); });

  /* ============ v10: contextual coach marks — video-game tutorial style ============ */
  var COACH_DEFS = {
    'screen-home': [
      { key: 'sos', sel: '#screen-home .panicbtn', title: 'SOS is one tap away', body: 'Anytime, anywhere in the app. No setup, no questions first.' },
      { key: 'pet', sel: '#pet-home', title: 'Meet your co-rider', body: '{pet} rides with you. Tap for a little love — no feeding, no fuss.' },
      { key: 'ride', sel: '#btn-start-ride', title: 'Start a ride when you board', body: 'How you feel, 30-second prep, then one tap per stop.' }
    ],
    'screen-toolkit': [
      { key: 'tools', sel: '#toolkit-featured .toolcard', title: 'Hands-on tools', body: 'These you do with your fingers — no reading required.' }
    ],
    'screen-trip': [
      { key: 'tap', sel: '#btn-stop-tap', title: 'One tap per stop', body: 'That\u2019s the whole job. The app counts down with you.' }
    ],
    'screen-comfort': [
      { key: 'cute', sel: '#social-grid', title: 'Cute things, one tap', body: 'Pick a platform up top, then a mood. Zero searching.' }
    ],
    'screen-plan': [
      { key: 'exit', sel: '#plan-exit', title: 'Your backup plan', body: 'Set it while you\u2019re calm. One glance when you\u2019re not.' }
    ]
  };
  var coachQueue = [], coachCurrent = null, coachVisible = false;
  function coachFlag(k) { return read('iht_coach_' + k); }
  function coachSet(k) { try { localStorage.setItem('iht_coach_' + k, '1'); } catch (e) {} }
  function coachEnsure() {
    var layer = $('coach-layer');
    if (layer) { return layer; }
    layer = document.createElement('div');
    layer.id = 'coach-layer';
    layer.innerHTML = '<div class="coach-shade" id="cs-t"></div><div class="coach-shade" id="cs-b"></div>'
      + '<div class="coach-shade" id="cs-l"></div><div class="coach-shade" id="cs-r"></div>'
      + '<div class="coach-ring" id="coach-ring"></div>'
      + '<div class="coach-bubble" id="coach-bubble"><strong id="coach-title"></strong><p id="coach-body"></p>'
      + '<button class="btn calm" id="coach-got">Got it</button>'
      + '<button class="linklike quiet" id="coach-skip" style="margin:6px auto 0">Skip hints</button></div>';
    document.body.appendChild(layer);
    $('coach-got').addEventListener('click', function () {
      tick();
      if (coachCurrent) { coachSet(coachCurrent.key); }
      coachNext();
    });
    $('coach-skip').addEventListener('click', function () { tick(); coachSkipAll(); });
    return layer;
  }
  function coachHide() {
    var l = $('coach-layer');
    if (l) { l.classList.remove('on'); }
    coachVisible = false; coachCurrent = null;
  }
  function coachPlace(id, css) {
    var el = $(id);
    if (!el) { return; }
    for (var k in css) { el.style[k] = css[k]; }
  }
  function coachNext() {
    coachCurrent = coachQueue.shift() || null;
    if (!coachCurrent) { coachHide(); return; }
    var t = document.querySelector(coachCurrent.sel);
    if (!t || !t.offsetParent) { coachNext(); return; } // target not on screen: skip, it re-queues next visit
    var r = t.getBoundingClientRect(), pad = 10;
    coachEnsure();
    coachPlace('cs-t', { left: '0', right: '0', top: '0', height: Math.max(0, r.top - pad) + 'px' });
    coachPlace('cs-b', { left: '0', right: '0', top: (r.bottom + pad) + 'px', bottom: '0' });
    coachPlace('cs-l', { left: '0', top: (r.top - pad) + 'px', height: (r.height + pad * 2) + 'px', width: Math.max(0, r.left - pad) + 'px' });
    coachPlace('cs-r', { top: (r.top - pad) + 'px', height: (r.height + pad * 2) + 'px', left: (r.right + pad) + 'px', right: '0' });
    coachPlace('coach-ring', { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    $('coach-title').textContent = coachCurrent.title;
    $('coach-body').textContent = (coachCurrent.body || '').replace('{pet}', pet.name || 'Mochi');
    var bw = Math.min(330, window.innerWidth - 32);
    var bx = Math.max(16, Math.min(r.left, window.innerWidth - bw - 16));
    var bh = 250;
    var by = (r.bottom + pad + 16 + bh < window.innerHeight) ? (r.bottom + pad + 16) : Math.max(16, r.top - pad - bh - 12);
    coachPlace('coach-bubble', { left: bx + 'px', top: by + 'px', width: bw + 'px' });
    $('coach-layer').classList.add('on');
    coachVisible = true;
  }
  function maybeCoach(screenId) {
    var defs = COACH_DEFS[screenId];
    if (!defs || coachVisible) { return; }
    var fresh = false;
    defs.forEach(function (d) { if (!coachFlag(d.key)) { coachQueue.push(d); fresh = true; } });
    if (fresh) { coachNext(); }
  }
  function coachSkipAll() {
    Object.keys(COACH_DEFS).forEach(function (s) { COACH_DEFS[s].forEach(function (d) { coachSet(d.key); }); });
    coachQueue = []; coachHide();
  }
  function coachReplay() {
    Object.keys(COACH_DEFS).forEach(function (s) {
      COACH_DEFS[s].forEach(function (d) { try { localStorage.removeItem('iht_coach_' + d.key); } catch (e) {} });
    });
    coachQueue = [];
    go('screen-home');
  }
  $('btn-replay-coach').addEventListener('click', function () { tick(); coachReplay(); });
  window.addEventListener('scroll', function () { if (coachVisible) { coachHide(); } }, { passive: true, capture: true });

  /* ============ v10: interactive tools — experiential, not reading assignments ============ */
  var TOOL_FNS = {};
  var ixReturn = 'screen-home';

  /* 5-4-3-2-1, interactive: tap a dot per sense */
  var SEN_STAGES = [
    { n: 5, tag: '5 · see', title: 'Five things you can see', hint: 'Look around. Tap a dot for each one. No rush.' },
    { n: 4, tag: '4 · feel', title: 'Four things you can feel', hint: 'Your feet, the seat, your hands, the air.' },
    { n: 3, tag: '3 · hear', title: 'Three things you can hear', hint: 'They can be quiet or ordinary.' },
    { n: 2, tag: '2 · smell', title: 'Two things you can smell', hint: 'Or two neutral details, if smells are hard.' },
    { n: 1, tag: '1 · taste', title: 'One thing you can taste', hint: 'Or the feeling of your mouth.' }
  ];
  var senStage = 0, senDone = 0;
  function renderSen() {
    var st = SEN_STAGES[senStage];
    $('sen-stage-label').textContent = st.tag;
    $('sen-title').textContent = st.title;
    $('sen-hint').textContent = st.hint;
    senDone = 0;
    $('sen-count').textContent = '0 of ' + st.n;
    $('btn-sen-skip').style.visibility = 'visible';
    var host = $('sen-dots'); host.innerHTML = '';
    for (var i = 0; i < st.n; i++) {
      (function () {
        var d = document.createElement('button');
        d.className = 'sendot'; d.setAttribute('aria-label', 'Mark one noticed');
        d.addEventListener('click', function () {
          if (d.classList.contains('on')) { return; }
          tick(); d.classList.add('on'); senDone++;
          $('sen-count').textContent = senDone + ' of ' + st.n;
          if (senDone >= st.n) { setTimeout(senNext, 500); }
        });
        host.appendChild(d);
      })();
    }
  }
  function senNext() {
    if (senStage < SEN_STAGES.length - 1) { senStage++; renderSen(); return; }
    $('sen-title').textContent = 'Well done.';
    $('sen-hint').textContent = 'You\u2019re back in the room.';
    $('sen-dots').innerHTML = ''; $('sen-count').textContent = '';
    $('btn-sen-skip').style.visibility = 'hidden';
    setTimeout(function () { go(ixReturn); }, 1500);
  }
  TOOL_FNS.senses = function (r) { ixReturn = r; senStage = 0; renderSen(); tick(); go('screen-senses'); };
  $('btn-sen-skip').addEventListener('click', function () { tick(); senNext(); });
  $('btn-sen-done').addEventListener('click', function () { tick(); go(ixReturn); });

  /* count backward, interactive */
  var cdN = 0;
  TOOL_FNS.countdown = function (r) {
    ixReturn = r;
    $('cd-pick').hidden = false; $('cd-run').hidden = true;
    $('cd-title').textContent = 'Count backward';
    tick(); go('screen-countdown');
  };
  $all('#cd-starts .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      tick();
      cdN = parseInt(c.getAttribute('data-n'), 10);
      $('cd-num').textContent = cdN;
      $('cd-pick').hidden = true; $('cd-run').hidden = false;
    });
  });
  $('cd-num').addEventListener('click', function () {
    if (cdN <= 0) { return; }
    cdN--; tick();
    var el = $('cd-num');
    el.textContent = cdN;
    el.style.transform = 'scale(.92)';
    setTimeout(function () { el.style.transform = ''; }, 130);
    if (cdN === 0) {
      $('cd-title').textContent = 'Done. Nicely steady.';
      setTimeout(function () { go(ixReturn); }, 1300);
    }
  });
  $('btn-cd-done').addEventListener('click', function () { tick(); go(ixReturn); });

  /* quiet category game, interactive */
  var CAT_CATS = ['Foods', 'Films', 'Animals', 'Places', 'Songs'];
  var catActive = null;
  (function renderCatChips() {
    var host = $('cat-cats');
    if (!host) { return; }
    CAT_CATS.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'chip'; b.textContent = c; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        tick();
        $all('#cat-cats .chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        catActive = c;
        $('cat-active').textContent = c + ' — name one at a time. Change whenever.';
        $('cat-list').innerHTML = '';
        $('cat-in').focus();
      });
      host.appendChild(b);
    });
  })();
  function catAdd() {
    var v = $('cat-in').value.trim().slice(0, 40);
    if (!v) { return; }
    if (!catActive) { $('cat-active').textContent = 'Pick a category first.'; return; }
    tick();
    var host = $('cat-list');
    var c = document.createElement('button');
    c.className = 'chip'; c.setAttribute('aria-pressed', 'false');
    var label = document.createElement('span'); label.textContent = v;
    var x = document.createElement('span'); x.className = 'x'; x.textContent = ' \u2715';
    c.appendChild(label); c.appendChild(x);
    c.addEventListener('click', function () { tick(); host.removeChild(c); });
    host.appendChild(c);
    $('cat-in').value = ''; $('cat-in').focus();
  }
  $('cat-add').addEventListener('click', catAdd);
  $('cat-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') { catAdd(); } });
  $('btn-cat-done').addEventListener('click', function () { tick(); go(ixReturn); });
  TOOL_FNS.categories = function (r) { ixReturn = r; tick(); go('screen-categories'); };

  /* gentle thought check, interactive with private inputs */
  var TH_STEPS = [
    { title: 'Name the scary thought', body: 'A few words, no arguing with yourself. This stays on your phone.', ph: 'e.g. I\u2019m trapped in here' },
    { title: 'What do you know for sure?', body: 'Facts only — not what fear is predicting.', ph: 'e.g. I\u2019m on a train; I can get off at the next stop' },
    { title: 'One kinder possibility', body: 'Not forced positivity — just a steadier story.', ph: 'e.g. I\u2019ve ridden this out before' }
  ];
  var thStep = 0, thData = {};
  function renderTh() {
    $('th-count').textContent = (thStep + 1) + ' of 3';
    $('th-title').textContent = TH_STEPS[thStep].title;
    $('th-body').textContent = TH_STEPS[thStep].body;
    $('th-in').placeholder = TH_STEPS[thStep].ph;
    $('th-in').value = thData[thStep] || '';
    $('btn-th-back').style.visibility = thStep === 0 ? 'hidden' : 'visible';
    $('btn-th-next').textContent = thStep === 2 ? 'Done' : 'Next';
  }
  TOOL_FNS.thought = function (r) { ixReturn = r; thStep = 0; thData = {}; renderTh(); tick(); go('screen-thought'); };
  $('btn-th-next').addEventListener('click', function () {
    tick();
    thData[thStep] = $('th-in').value.trim();
    if (thStep < 2) { thStep++; renderTh(); $('th-in').focus(); }
    else { go(ixReturn); }
  });
  $('btn-th-back').addEventListener('click', function () { tick(); if (thStep > 0) { thStep--; renderTh(); } });
  $('btn-th-done').addEventListener('click', function () { tick(); go(ixReturn); });

  /* kind words deck */
  var KW_LINES = [
    'This is a hard moment, and I can choose one small next step.',
    'I am allowed to ask someone for support.',
    'Panic is awful, but it is not dangerous — and it always passes.',
    'I\u2019ve felt this before and I got through it.',
    'I don\u2019t have to solve the whole ride. Just this minute.',
    'My body is trying to protect me. I can thank it and stand down.',
    'It\u2019s okay to take up space and breathe.',
    'One stop at a time is enough.'
  ];
  var kwIdx = 0;
  function renderKw() {
    var el = $('kw-text');
    el.style.transition = 'opacity .25s ease';
    el.style.opacity = '0';
    setTimeout(function () {
      el.textContent = '\u201C' + KW_LINES[kwIdx % KW_LINES.length] + '\u201D';
      el.style.opacity = '1';
    }, 170);
  }
  TOOL_FNS.kindwords = function (r) { ixReturn = r; kwIdx = Math.floor(Math.random() * KW_LINES.length); renderKw(); tick(); go('screen-kindwords'); };
  $('btn-kw-next').addEventListener('click', function () { tick(); kwIdx++; renderKw(); });
  $('btn-kw-done').addEventListener('click', function () { tick(); go(ixReturn); });

  /* muscle release, timed hold */
  var MU_PARTS = [
    { t: 'Hands', b: 'Press your fingertips together gently — not hard, just firm.' },
    { t: 'Shoulders', b: 'Lift your shoulders a little toward your ears. No straining.' },
    { t: 'Jaw and face', b: 'Soften your jaw. Let your face go slack.' }
  ];
  var muIdx = 0, muHolding = false, muT0 = 0, muRaf = null;
  function renderMu() {
    $('mu-count').textContent = (muIdx + 1) + ' of ' + MU_PARTS.length;
    $('mu-title').textContent = MU_PARTS[muIdx].t;
    $('mu-body').textContent = MU_PARTS[muIdx].b;
    $('mu-nav').hidden = true;
    $('mu-hint').textContent = 'Hold to tense · release to let go. Skip anything uncomfortable.';
    $('btn-mu-back').style.visibility = muIdx === 0 ? 'hidden' : 'visible';
    $('btn-mu-next').textContent = muIdx === MU_PARTS.length - 1 ? 'Done' : 'Next';
  }
  TOOL_FNS.muscle = function (r) { ixReturn = r; muIdx = 0; renderMu(); tick(); go('screen-muscle'); };
  (function () {
    var btn = $('mu-btn'), fill = $('mu-fill');
    if (!btn || !fill) { return; }
    function start() {
      if (muHolding) { return; }
      muHolding = true; muT0 = performance.now();
      cancelAnimationFrame(muRaf);
      var step = function () {
        var p = Math.min(1, (performance.now() - muT0) / 5000);
        fill.style.transform = 'scale(' + (0.2 + 0.8 * p) + ')';
        if (p < 1 && muHolding) { muRaf = requestAnimationFrame(step); }
      };
      step();
    }
    function end() {
      if (!muHolding) { return; }
      muHolding = false; cancelAnimationFrame(muRaf);
      fill.style.transform = 'scale(0.2)';
      $('mu-hint').textContent = 'And let go. Notice the softness for a breath or two.';
      $('mu-nav').hidden = false;
    }
    btn.addEventListener('touchstart', start, { passive: true });
    btn.addEventListener('touchend', end);
    btn.addEventListener('touchcancel', end);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
    stopMuscleHold = end;
  })();
  $('btn-mu-next').addEventListener('click', function () {
    tick();
    if (muIdx < MU_PARTS.length - 1) { muIdx++; renderMu(); }
    else { go(ixReturn); }
  });
  $('btn-mu-back').addEventListener('click', function () { tick(); if (muIdx > 0) { muIdx--; renderMu(); } });
  $('btn-mu-done').addEventListener('click', function () { tick(); go(ixReturn); });

  /* butterfly taps, bilateral */
  var flyN = 0, flyExpect = 'L';
  var FLY_TOTAL = 12;
  function renderFlyDots() {
    var host = $('fly-dots');
    if (!host) { return; }
    host.innerHTML = '';
    for (var i = 0; i < FLY_TOTAL; i++) {
      var d = document.createElement('i');
      if (i < flyN) { d.className = 'on'; }
      host.appendChild(d);
    }
  }
  function flyReset() {
    flyN = 0; flyExpect = 'L';
    renderFlyDots();
    var h = $('fly-hint');
    if (h) { h.textContent = 'Left, right, left, right…'; }
  }
  function flyTap(side) {
    var el = side === 'L' ? $('fly-l') : $('fly-r');
    if (side !== flyExpect) {
      $('fly-hint').textContent = side === 'L' ? 'Right side now — nice and slow.' : 'Left side now — nice and slow.';
      return;
    }
    tick();
    el.classList.add('hit');
    setTimeout(function () { el.classList.remove('hit'); }, 230);
    flyN++; flyExpect = flyExpect === 'L' ? 'R' : 'L';
    renderFlyDots();
    $('fly-hint').textContent = flyExpect === 'L' ? 'Left…' : 'Right…';
    if (flyN >= FLY_TOTAL) {
      $('fly-hint').textContent = 'Steady rhythm. Well done.';
      setTimeout(function () { go(gestureReturn); }, 1400);
    }
  }
  $('fly-l').addEventListener('click', function () { flyTap('L'); });
  $('fly-r').addEventListener('click', function () { flyTap('R'); });
  $('btn-fly-done').addEventListener('click', function () { tick(); go(gestureReturn); });

  /* ---------- boot: onboarding first, then home. Coach marks guide from there. ---------- */
  applyProfileToHome();
  renderHomePet();
  petInto($('pet-breathe'), 'sleepy');
  renderBreatheCap();
  if (!read('iht_onboarded')) { go('screen-ob1'); }
  else { go('screen-home'); }

})();
