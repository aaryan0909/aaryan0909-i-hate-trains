/* I Hate Trains — v12. Free forever. Feel-first, quality over quantity. Offline-first: no network in core flows. */
(function () {
  'use strict';

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function currentScreen() { var a = document.querySelector('.screen.active'); return a ? a.id : null; }
  var navBack = [], navFwd = [];
  var panicFreezeTimer = null, splashTimer = null, splashActive = false;
  /* v31 audit: celebration cooldown. If panic recurs within 10 minutes of the
     last "I'm steadier", the pet stays steady, never chirpy. A repeated
     celebration after a relapse feels mocking. */
  var suppressCelebration = false;
  function recentSteady() {
    try {
      var t = parseInt(localStorage.getItem('iht_last_steady') || '0', 10);
      return !!t && (Date.now() - t < 10 * 60 * 1000);
    } catch (e) { return false; }
  }
  function markSteady() { try { localStorage.setItem('iht_last_steady', String(Date.now())); } catch (e) {} }
  function clearPanicFreeze() { if (panicFreezeTimer) { clearTimeout(panicFreezeTimer); panicFreezeTimer = null; } }
  function clearSplashTimers() { if (splashTimer) { clearTimeout(splashTimer); splashTimer = null; } splashActive = false; }
  function go(id, opts) {
    opts = opts || {};
    clearPanicFreeze(); clearSplashTimers();
    var cur = currentScreen();
    if (!opts.keep && cur && cur !== id) { navBack.push(cur); if (navBack.length > 30) { navBack.shift(); } navFwd = []; }
    if (coachVisible) { coachHide(); } // navigating dismisses the hint (it returns next visit)
    $all('.screen').forEach(function (s) { s.classList.remove('active'); });
    var el = $(id);
    if (el) { el.classList.add('active'); window.scrollTo(0, 0); }
    if (id === 'screen-ob0') { resetOb0State(); } // any entry to the breath screen resets it (warm reload, swipe-back)
    if (id !== 'screen-breathe') { stopBreathe(); } // leaving the exercise always stops it cleanly
    if (id !== 'screen-ob0') { stopObBreath(); } // leaving setup stops the first-breath timer too
    if (id !== 'screen-guide' && window.__ihtGuide) { try { window.__ihtGuide.stop(); } catch (e) {} } // v27: leaving the eyes-free rescue stops it cleanly
    stopHold(); stopMuscleHold(); // never leave a hold tone or rAF loop running on a hidden screen
    if (id === 'screen-butterfly') { flyReset(); }
    updateSosFloat(id);
    maybeCoach(id);
    maybeShowUpdateBanner(); // update prompt only ever appears on calm, non-crisis screens
    if (id === 'screen-panic') { renderPanicPlan(); suppressCelebration = recentSteady(); armPanicFreeze(); } // v31: plan line + celebration cooldown + freeze auto-start
    if (id === 'screen-toolkit') { renderTopTools(); } // v31: "What has helped you" lives in the toolkit now, not home
    if (id !== 'screen-petplay') { fireflyActive = false; var fh = $('play-fireflies'); if (fh) { fh.classList.add('hidden'); } } // v34: leaving play ends the game
    mountScreenPets(); renderPetScreenLines(); // v33: the pet guides every screen
    if (id === 'screen-home' && cur && cur !== 'screen-home' && cur !== 'screen-splash' && cur !== 'screen-panic') { waveHomePet(); } // v34: home return gets a wave + hi
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
  var SOS_HIDDEN = { 'screen-home': 1, 'screen-panic': 1, 'screen-breathe': 1, 'screen-guide': 1, 'screen-splash': 1, 'screen-ob0': 1, 'screen-ob1': 1, 'screen-ob2': 1 };
  function updateSosFloat(id) {
    var f = $('sos-float');
    if (f) { f.hidden = !!SOS_HIDDEN[id]; }
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function readJSON(k, fb) { try { var v = JSON.parse(read(k)); return v == null ? fb : v; } catch (e) { return fb; } }

  /* ---------- storage migration (v18): stamp a schema version, never delete.
     Runs before any iht_* key is read. Existing data is already current-shaped, so v0→v1
     only stamps. Unknown iht_* keys pass through untouched (forward-compat). The only
     code that ever removes iht_* keys is the user-initiated "erase everything". ---------- */
  var IHT_SCHEMA_VERSION = 1;
  function migrateStorage() {
    var raw = read('iht_schema_version');
    var v = raw === null ? 0 : (parseInt(raw, 10) || 0);
    if (v < 1) { store('iht_schema_version', '1'); }
    /* future: if (v < 2) { ...shape changes...; store('iht_schema_version', '2'); } */
  }
  migrateStorage();

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
    rome: { nick: 'La metro', match: ['rome', 'roma'], lede: 'You are riding the Eternal City.', checkin: 'How are you feeling in Rome?', arrived: 'You made it through Rome.' },
    milan: { nick: 'La metro', match: ['milan', 'milano'], lede: 'You are riding Milan.', checkin: 'How are you feeling in Milan?', arrived: 'You made it through Milan.' },
    naples: { nick: 'La metro', match: ['naples', 'napoli'], lede: 'You are riding Naples.', checkin: 'How are you feeling in Naples?', arrived: 'You made it through Naples.' },
    turin: { nick: 'La metro', match: ['turin', 'torino'], lede: 'You are riding Turin.', checkin: 'How are you feeling in Turin?', arrived: 'You made it through Turin.' },
    mumbai: { nick: 'Local life', match: ['mumbai', 'bombay'], lede: 'You are riding Mumbai.', checkin: 'How are you feeling in Mumbai?', arrived: 'You made it through Mumbai.' },
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
    if (window.__ihtSound) { // v35: breath swells (4s in / 6s out) from sound.js
      try { if (window.__ihtSound.breath(k)) { return; } } catch (e) {}
    }
    if (k === 'in') { chime(523.25, 1.1, 0.10); }      // fallback: soft high chime
    else if (k === 'out') { chime(392.0, 1.4, 0.08); } // fallback: lower, softer
    else { chime(440, 0.5, 0.035); }                  // fallback: barely-there tick
  }

  /* ---------- v35: removed. The pet guides with on-screen text and bubbles only;
     all sound now comes from sound.js (window.__ihtSound). See REPORT.md. ---------- */

  /* ---------- generative ambient pad: soft detuned oscillators through a lowpass, slow-evolving warm chord.
     Synthesized live with Web Audio — zero files, works fully offline, iOS-safe after the tap gesture. ---------- */
  var ambState = null;
  function ambientStart() {
    if (window.__ihtSound) { // v35: clearly audible pad + playing indicator
      try { window.__ihtSound.setMode(prefs.breathSound || 'chimes'); return window.__ihtSound.ambientStart(); } catch (e) {}
    }
    var ctx = ensureAudio();
    if (!ctx) { return; }
    ambientStop();
    if (window.Drift && typeof window.Drift.start === 'function') {
      try { window.Drift.start(ctx); return; } // "Drift": composed generative piece (drift.js); falls through to the legacy pad on any failure
      catch (e) {}
    }
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
    if (window.__ihtSound) { // v35: paired with the delegated ambientStart above
      try { window.__ihtSound.ambientStop(); } catch (e) {}
      return;
    }
    try { if (window.Drift && typeof window.Drift.stop === 'function') { window.Drift.stop(); } } catch (e) {}
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
      { k: 'in', secs: 4, word: 'In', cap: 'Easy.' },
      { k: 'hold', secs: 4, word: 'Hold', cap: 'Rest here.' },
      { k: 'out', secs: 6, word: 'Out', cap: 'Let go.' } ] },
    box: { label: 'Box', phases: [
      { k: 'in', secs: 4, word: 'In', cap: 'Four counts.' },
      { k: 'hold', secs: 4, word: 'Hold', cap: 'Four counts.' },
      { k: 'out', secs: 4, word: 'Out', cap: 'Four counts.' },
      { k: 'rest', secs: 4, word: 'Rest', cap: 'Four counts.' } ] },
    '478': { label: '4–7–8', phases: [
      { k: 'in', secs: 4, word: 'In', cap: 'Gently.' },
      { k: 'hold', secs: 7, word: 'Hold', cap: 'Only if comfortable.' },
      { k: 'out', secs: 8, word: 'Out', cap: 'Never force it.' } ] }
  };
  /* v31: the pattern is remembered, not re-chosen mid-exercise. The chips live
     behind one "Options" tap on the breathe screen; the running screen shows
     only the pet, one word, and the safety line. */
  var breathPattern = (prefs.breathPattern && PATTERNS[prefs.breathPattern]) ? prefs.breathPattern : 'gentle';
  $all('#breath-patterns .pchip').forEach(function (c) {
    c.addEventListener('click', function () {
      tick();
      $all('#breath-patterns .pchip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      c.setAttribute('aria-pressed', 'true');
      breathPattern = c.getAttribute('data-pattern');
      prefs.breathPattern = breathPattern; savePrefs();
    });
  });
  function setBreathPattern(p) {
    breathPattern = p;
    $all('#breath-patterns .pchip').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-pattern') === p ? 'true' : 'false'); });
  }
  /* v31 pet engine: ONE timer drives the pet. The pet's squash-and-stretch IS the
     breath signal: inhale stretches it tall, exhale settles it back. No separate
     pet loop exists during breathing — that was the "breathing, not with you" bug.
     Reduced-motion riders get an opacity phase signal instead of scale. */
  var petBreathIn = false;
  var reducedMotion = false;
  try { reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
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
    var grow = (p.k === 'in');
    petBreathIn = grow;
    var pb = $('pet-breathe'); // v22: Mochi IS the breathing guide — big, unmissable, in sync
    if (pb) {
      pb.style.transition = reducedMotion ? 'opacity 1.2s ease' : 'transform ' + p.secs + 's cubic-bezier(.37,0,.63,1)';
      if (reducedMotion) { pb.style.transform = 'none'; pb.style.opacity = grow ? '1' : '0.55'; }
      else { pb.style.transform = grow ? 'scale(0.94, 1.2)' : 'scale(1, 1)'; }
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
    try { if (window.__ihtSound) { window.__ihtSound.unlock(); window.__ihtSound.setMode(prefs.breathSound || 'chimes'); } } catch (e) {}
    petInto($('pet-breathe'), 'sleepy'); // the guide settles in, calm and ready
    renderBreatheCap();
    var nm0 = pet.name || 'Mochi';
    var bc0 = $('breath-cap');
    if (bc0) { bc0.textContent = 'Follow ' + nm0 + '.'; } // the pet tells you what to do
    setBreathPattern(pattern || prefs.breathPattern || 'gentle');
    $('breath-patterns').classList.toggle('hidden', !!minimal);
    var sc = $('screen-breathe');
    if (sc) { sc.classList.add('running'); } // v31: settings hide while the exercise runs
    var pb0 = $('pet-breathe');
    if (pb0) { pb0.style.transition = 'none'; pb0.style.transform = 'scale(1, 1)'; pb0.style.opacity = '1'; }
    tick(); go('screen-breathe');
    var mode = prefs.breathSound || 'chimes';
    if (mode === 'ambient' || mode === 'both') { ambientStart(); }
    runPhase(PATTERNS[breathPattern].phases, 0); // no gate: the exercise starts NOW
  }
  function stopBreathe() {
    if (breathTimer) { clearTimeout(breathTimer); breathTimer = null; }
    if (breathSwap) { clearTimeout(breathSwap); breathSwap = null; }
    petBreathIn = false;
    var sc = $('screen-breathe');
    if (sc) { sc.classList.remove('running'); }
    ambientStop();
  }
  /* v31: one quiet "Options" tap reveals the pattern/sound settings mid-exercise. */
  (function () {
    var b = $('btn-breathe-opts');
    if (!b) { return; }
    b.addEventListener('click', function () {
      tick();
      var sc = $('screen-breathe');
      if (sc) { sc.classList.toggle('running'); }
    });
  })();
  var stopHold = function () {}; // replaced by the hold-to-steady tool below; go() calls it so a mid-hold navigation never leaves the tone droning
  var stopMuscleHold = function () {}; // replaced by the muscle-release hold ring below (same reason: never leave a rAF loop running on a hidden screen)
  $('btn-breathe-end').addEventListener('click', function () { tick(); stopBreathe(); markSteady();
    /* v35: completion chime for calm-time breathing only. The panic flow
       returns to screen-panic and stays silent: no chirpy sound after panic. */
    try {
      if (breatheReturn !== 'screen-panic') {
        var cm = prefs.breathSound || 'chimes';
        if ((cm === 'chimes' || cm === 'both') && window.__ihtSound) { window.__ihtSound.completion(); }
      }
    } catch (e) {}
    go(breatheReturn); });
  /* v31: guide-end lives in guide.js; this second listener only stamps the
     celebration-cooldown clock. Multiple listeners on one button are fine. */
  (function () {
    var b = $('btn-guide-end');
    if (b) { b.addEventListener('click', function () { markSteady(); }); }
  })();

  /* panic entry: minimal sacred flow. The rescue's "try grounding instead" branch
     (v31 audit): when breathing fails, the rider branches to grounding without a
     menu, a question, or a restart. */
  $('btn-panic-breathe').addEventListener('click', function () { startBreathe('gentle', 'screen-panic', true); });
  $('btn-panic-ground').addEventListener('click', function () { openTool('five-senses', 'screen-panic'); });
  (function () {
    var b = $('btn-guide-ground');
    if (!b) { return; }
    b.addEventListener('click', function () {
      tick();
      try { if (window.__ihtGuide) { window.__ihtGuide.stop(); } } catch (e) {}
      openTool('five-senses', 'screen-panic');
    });
  })();
  /* v31: home "More" reveals the calm-time tiles (Learn, plan, history, privacy,
     about) that used to compete with the panic button. */
  (function () {
    var b = $('btn-home-more'), more = $('homenav-more');
    if (!b || !more) { return; }
    b.addEventListener('click', function () {
      tick();
      more.hidden = !more.hidden;
      b.textContent = more.hidden ? 'More' : 'Less';
    });
  })();
  /* v31: toolkit groups collapse to one open section at a time (spec phase 2).
     The first section opens by default; headers are tappable. */
  (function () {
    var host = $('toolkit-groups');
    if (!host) { return; }
    function collapseToolkit() {
      var headers = $all('#toolkit-groups .toolgroup');
      headers.forEach(function (h, i) {
        var list = h.nextElementSibling;
        if (!list || !list.classList.contains('toolcards')) { return; }
        h.style.cursor = 'pointer';
        h.setAttribute('role', 'button');
        h.setAttribute('tabindex', '0');
        h.setAttribute('aria-expanded', i === 0 ? 'true' : 'false');
        list.hidden = i !== 0;
        h.addEventListener('click', function () {
          tick();
          headers.forEach(function (h2) {
            var l2 = h2.nextElementSibling;
            if (l2 && l2.classList.contains('toolcards')) { l2.hidden = true; h2.setAttribute('aria-expanded', 'false'); }
          });
          list.hidden = false;
          h.setAttribute('aria-expanded', 'true');
        });
      });
    }
    /* renderToolkit runs synchronously above this block, so the groups exist now. */
    collapseToolkit();
  })();

  /* v31: the panic screen carries a one-line backup-plan reminder, not a link.
     Pre-commitment only works if it is visible at the moment of crisis. When a
     plan exists, the plan line REPLACES the reassurance line (one line, not two).
     When no plan exists, the reassurance line stands alone. */
  function renderPanicPlan() {
    var line = $('panic-plan-line'), re = $('panic-reassure');
    if (!line || !re) { return; }
    var bits = [];
    try {
      if (plan.exit) { bits.push('get off at ' + String(plan.exit).slice(0, 40)); }
      if (plan.reachName) { bits.push('call ' + String(plan.reachName).slice(0, 40)); }
    } catch (e) {}
    if (bits.length) {
      line.textContent = 'Your plan: ' + bits.join(', ') + '.';
      line.hidden = false; re.hidden = true;
    } else {
      line.hidden = true; re.hidden = false;
    }
  }
  /* v31 audit, highest-leverage change: a rider who taps "I need help right now"
     and then freezes gets help anyway. 5 seconds of nothing on the panic screen
     auto-starts the scripted rescue. Any tap re-arms the timer; any navigation
     clears it (go() above). */
  function armPanicFreeze() {
    clearPanicFreeze();
    panicFreezeTimer = setTimeout(function () {
      panicFreezeTimer = null;
      if (currentScreen() === 'screen-panic' && window.__ihtGuide) {
        try { window.__ihtGuide.start(); } catch (e) {}
      }
    }, 5000);
  }
  document.addEventListener('pointerdown', function () {
    if (currentScreen() === 'screen-panic') { armPanicFreeze(); }
  }, { passive: true });

  function toolByTitle(title) {
    for (var i = 0; i < TOOLS.length; i++) { if (TOOLS[i].title === title) { return TOOLS[i]; } }
    return null;
  }
  /* "your most calming tools": aggregate iht_journal on-device and show the
     top 3 on the home screen (calm time only, never the panic flow). Counts
     are rides, not scores: one entry counts once per tool, ties break toward
     the most recent ride, a corrupt journal hides the card. Nothing leaves
     the phone, no new storage keys, no streaks, no grades. */
  function renderTopTools() {
    var card = $('home-top-tools'), list = $('home-top-tools-list');
    if (!card || !list) { return; }
    var ranked = [];
    try {
      var log = readJSON('iht_journal', []);
      var counts = {}, lastSeen = {}, ridesNamed = 0;
      log.forEach(function (e, idx) {
        if (!e || !e.tools || !e.tools.length) { return; }
        ridesNamed++;
        var seen = {};
        e.tools.forEach(function (title) {
          if (seen[title]) { return; } seen[title] = true;
          var t = toolByTitle(title);
          if (!t) { return; }
          counts[title] = (counts[title] || 0) + 1;
          lastSeen[title] = idx;
        });
      });
      /* v31 audit: never show until at least three rides have named a tool,
         or it is an empty promise dressed as insight. */
      if (ridesNamed < 3) { card.hidden = true; return; }
      ranked = Object.keys(counts).map(function (title) {
        return { tool: toolByTitle(title), count: counts[title], last: lastSeen[title] };
      }).sort(function (a, b) { return (b.count - a.count) || (b.last - a.last); }).slice(0, 3);
    } catch (err) { ranked = []; }
    if (!ranked.length) { card.hidden = true; return; }
    list.innerHTML = '';
    ranked.forEach(function (row) {
      var b = document.createElement('button');
      b.className = 'toptool'; b.type = 'button';
      var tx = document.createElement('span'); tx.className = 'tt-tx';
      var strong = document.createElement('strong'); strong.textContent = row.tool.title;
      var em = document.createElement('em');
      em.textContent = 'helped on ' + row.count + (row.count === 1 ? ' ride' : ' rides');
      tx.appendChild(strong); tx.appendChild(em);
      var go2 = document.createElement('span'); go2.className = 'tt-go'; go2.textContent = 'Start';
      b.appendChild(tx); b.appendChild(go2);
      b.addEventListener('click', function () {
        tick();
        if (row.tool.pattern) { startBreathe(row.tool.pattern, 'screen-home', false); }
        else { openTool(row.tool.id, 'screen-home'); }
      });
      list.appendChild(b);
    });
    card.hidden = false;
  }

  /* comfort is a solution, not a silo: reachable from the toolkit, home, and mid-trip.
     v31: comfort is NO LONGER reachable from the panic screen (audit: redirects
     during panic break companion presence). Post-"I'm steadier" only. */
  var comfortReturn = 'screen-home';
  $('btn-comfort-back').addEventListener('click', function () { tick(); go(comfortReturn); });
  $('link-comfort-home').addEventListener('click', function () { comfortReturn = 'screen-home'; });
  $('tool-comfort').addEventListener('click', function () { comfortReturn = 'screen-trip'; });

  /* the backup plan, one glance away from the panic flow (v31: as a one-line
     reminder ON the panic screen, not a link away from it) */
  var planReturn = 'screen-home';
  $('btn-plan-back').addEventListener('click', function () { tick(); go(planReturn); });
  $('link-plan-home').addEventListener('click', function () { planReturn = 'screen-home'; });

  /* trip tools */
  $('tool-breathe').addEventListener('click', function () { startBreathe('gentle', 'screen-trip', false); });
  $('tool-ground').addEventListener('click', function () { openTool('five-senses', 'screen-trip'); });

  /* ---------- trip ambient (v35): delegated to sound.js. The replaced block
     played one quiet low-filtered noise bed with only a label flip as feedback
     (nearly inaudible on a phone). The new ambient is a pitched pad at
     a real level with a pulsing playing indicator; sound.js owns the indicator
     and the label. This handler only unlocks (inside the tap), confirms with a
     soft tap, and toggles. The trip tool is independent of prefs.breathSound. ---------- */
  $('tool-sound').addEventListener('click', function () {
    tick();
    if (!window.__ihtSound) { $('sound-label').textContent = 'Ambient n/a'; return; }
    try {
      window.__ihtSound.unlock(); // gesture unlock for iOS
      window.__ihtSound.tap(); // audible confirmation, calm-time trip screen only
      window.__ihtSound.toggleAmbient(); // sound.js syncs indicator + label
    } catch (e) { $('sound-label').textContent = 'Ambient n/a'; }
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
      try { petInto($('pet-checkin'), 'idle', null, checkinFeel === 'steady' ? 'happy' : 'worried'); } catch (e) {} // v34: the face matches the feeling
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
  /* TriMap bridge: the chooser sets the computed stop count; the map reads
     the live shared counter. Both go through the existing state. */
  window.__ihtSetStops = function (n) { setupStops = n; renderSetupStops(); };
  window.__ihtTripLeft = function () { return trip.left; };
  $('stops-minus').addEventListener('click', function () { tick(); if (setupStops > 1) { setupStops--; renderSetupStops(); } });
  $('stops-plus').addEventListener('click', function () { tick(); if (setupStops < 40) { setupStops++; renderSetupStops(); } });
  renderSetupStops();

  /* ---------- v35 ride setup: cascading dropdowns, taps not typing.
       City -> that city's lines (metros.js) -> that line's ordered stops
       (stations.js contract; null means manual fallback). The hidden
       in-city / in-line / in-dest inputs keep the canonical route for the
       trip card, the map chooser, and location lookup. Shortcuts and the
       last ride live on-device only (iht_shortcuts, iht_last_ride).
       Storage migration: nothing old is deleted; profile.city / profile.line
       still prefill, now through the dropdowns. ---------- */
  var setupCityId = null, setupLineId = null, setupLineName = '';
  var setupStationData = null, setupStations = null;
  var setupFromIdx = -1, setupDestIdx = -1, setupManualMode = false;
  var setupStationToken = 0, setupCitiesFilled = false;
  function setupEl(id) { return $(id); }
  function setupFillSelect(sel, items, placeholder) {
    if (!sel) { return; }
    sel.innerHTML = '';
    var ph = document.createElement('option'); ph.value = ''; ph.textContent = placeholder;
    sel.appendChild(ph);
    items.forEach(function (it) {
      var o = document.createElement('option'); o.value = it.v; o.textContent = it.l; sel.appendChild(o);
    });
  }
  function setupMetroLines() {
    if (!setupCityId || !window.__ihtMetros) { return []; }
    var c = window.__ihtMetros.cities[setupCityId];
    return c ? c.lines : [];
  }
  function setupInvalidateMap() { if (window.TriMap) { TriMap.current = null; } }
  function setupSyncHidden() {
    var cityEl = $('in-city'), lineEl = $('in-line'), destEl = $('in-dest');
    if (setupManualMode) {
      if (cityEl) { cityEl.value = ($('in-manual-city') && $('in-manual-city').value) || ''; }
      if (lineEl) { lineEl.value = ($('in-manual-line') && $('in-manual-line').value) || ''; }
      if (destEl) { destEl.value = ($('in-manual-dest') && $('in-manual-dest').value) || ''; }
    } else {
      /* Preserve a value we do not own (e.g. a map-chooser pick on a line
         with no station list yet); only overwrite with a known value. */
      if (cityEl && setupCityId && window.__ihtMetros && window.__ihtMetros.cities[setupCityId]) { cityEl.value = window.__ihtMetros.cities[setupCityId].label; }
      if (lineEl && setupLineName) { lineEl.value = setupLineName; }
      if (destEl && setupStations && setupDestIdx >= 0) { destEl.value = setupStations[setupDestIdx]; }
    }
    try { if (cityEl) { cityEl.dispatchEvent(new Event('change')); } } catch (e) {}
  }
  function setupStopsNote() {
    var note = $('setup-stops-note'); if (!note) { return; }
    var start = $('btn-start-trip');
    if (setupManualMode) {
      note.textContent = 'Counted by hand. The stepper is yours.';
      if (start) { start.disabled = false; }
      return;
    }
    if (setupStations && setupFromIdx >= 0 && setupDestIdx >= 0) {
      if (setupFromIdx === setupDestIdx) {
        note.textContent = 'Boarding and destination are the same stop. Pick a different stop.';
        if (start) { start.disabled = true; }
      } else {
        note.textContent = setupStops + (setupStops === 1 ? ' stop, from ' : ' stops, from ')
          + setupStations[setupFromIdx] + ' to ' + setupStations[setupDestIdx] + '. Counted from the line order.';
        if (start) { start.disabled = false; }
      }
    } else if (setupStations) {
      note.textContent = 'Pick your boarding stop and destination and the count works itself out.';
      if (start) { start.disabled = false; }
    } else if (setupCityId && setupLineId) {
      note.textContent = 'Station lists are not in yet for this line, so the stops are counted by hand with the stepper.';
      if (start) { start.disabled = false; }
    } else {
      note.textContent = 'Pick your stops and the count works itself out.';
      if (start) { start.disabled = false; }
    }
  }
  function setupApplyRoute() {
    setupSyncHidden();
    if (!setupManualMode && setupStations && setupFromIdx >= 0 && setupDestIdx >= 0 && setupFromIdx !== setupDestIdx) {
      var n = window.IHTStations ? window.IHTStations.stopsBetween(setupStations, setupStations[setupFromIdx], setupStations[setupDestIdx]) : null;
      if (n != null) { setupStops = n; renderSetupStops(); }
    }
    setupStopsNote();
  }
  function setupFillStopSelects() {
    var from = $('sel-from'), dest = $('sel-dest');
    if (!setupStations) {
      if (from) { setupFillSelect(from, [], 'Station lists are not in yet'); from.disabled = true; }
      if (dest) { setupFillSelect(dest, [], 'Station lists are not in yet'); dest.disabled = true; }
      setupFromIdx = -1; setupDestIdx = -1;
      return;
    }
    var items = setupStations.map(function (s, i) { return { v: String(i), l: s }; });
    if (from) { setupFillSelect(from, items, 'Where do you board?'); from.disabled = false; }
    if (dest) { setupFillSelect(dest, items, 'Where do you get off?'); dest.disabled = false; }
    if (from && setupFromIdx >= 0) { from.value = String(setupFromIdx); }
    if (dest && setupDestIdx >= 0) { dest.value = String(setupDestIdx); }
  }
  function setupDataNote() {
    var note = $('setup-data-note'); if (!note) { return; }
    if (setupManualMode) { note.textContent = ''; }
    else if (setupStationData) { note.textContent = 'Station list for ' + (setupStationData.city || '') + '. Taps only, no typing.'; }
    else if (setupCityId && setupLineId) { note.textContent = 'Station lists are not in yet for this line. The stepper below counts by hand.'; }
    else if (setupCityId) { note.textContent = ''; }
    else { note.textContent = ''; }
  }
  function setupLoadStations(cityId, then) {
    if (!window.IHTStations) { if (then) { then(null); } return; }
    var tok = ++setupStationToken;
    window.IHTStations.load(cityId).then(function (d) {
      if (tok !== setupStationToken) { return; }
      setupStationData = d;
      var line = d ? window.IHTStations.findLine(d, setupLineId, setupLineName) : null;
      setupStations = line ? line.stations : null;
      setupFromIdx = -1; setupDestIdx = -1;
      setupFillStopSelects();
      setupDataNote();
      setupApplyRoute();
      if (then) { then(d); }
    });
  }
  function setupOnCity() {
    var sel = $('sel-city'); if (!sel) { return; }
    setupInvalidateMap();
    var v = sel.value;
    var manual = $('setup-manual');
    if (!v || v === '__other') {
      setupCityId = null; setupLineId = null; setupLineName = '';
      setupStationData = null; setupStations = null; setupFromIdx = -1; setupDestIdx = -1;
      setupManualMode = true;
      if (manual) { manual.hidden = false; }
      var ls = $('sel-line'); if (ls) { setupFillSelect(ls, [], 'Pick a city first'); ls.disabled = true; }
      setupFillStopSelects(); setupDataNote(); setupSyncHidden(); setupStopsNote();
      return;
    }
    setupManualMode = false;
    if (manual) { manual.hidden = true; }
    setupCityId = v;
    var lines = setupMetroLines();
    var ls2 = $('sel-line');
    if (ls2) { setupFillSelect(ls2, lines.map(function (l) { return { v: l.id, l: l.name }; }), 'Pick a line'); ls2.disabled = false; }
    setupLineId = null; setupLineName = ''; setupStations = null; setupStationData = null;
    if ($('in-line')) { $('in-line').value = ''; }
    if ($('in-dest')) { $('in-dest').value = ''; }
    setupFillStopSelects();
    setupLoadStations(v);
    setupSyncHidden(); setupStopsNote();
  }
  function setupOnLine() {
    var sel = $('sel-line'); if (!sel) { return; }
    setupInvalidateMap();
    setupLineId = sel.value || null;
    var lines = setupMetroLines(), found = null;
    lines.forEach(function (l) { if (l.id === setupLineId) { found = l; } });
    setupLineName = found ? found.name : '';
    if (setupStationData) {
      var line = window.IHTStations ? window.IHTStations.findLine(setupStationData, setupLineId, setupLineName) : null;
      setupStations = line ? line.stations : null;
    } else { setupStations = null; }
    setupFromIdx = -1; setupDestIdx = -1;
    if ($('in-dest')) { $('in-dest').value = ''; }
    setupFillStopSelects(); setupDataNote(); setupApplyRoute();
  }
  function setupOnStop() {
    setupInvalidateMap();
    var f = $('sel-from'), d = $('sel-dest');
    setupFromIdx = f && f.value !== '' ? parseInt(f.value, 10) : -1;
    setupDestIdx = d && d.value !== '' ? parseInt(d.value, 10) : -1;
    setupApplyRoute();
  }
  function setupFillCities() {
    if (setupCitiesFilled) { return; }
    var sel = $('sel-city'); if (!sel || !window.__ihtMetros) { return; }
    var items = Object.keys(window.__ihtMetros.cities).map(function (k) { return { v: k, l: window.__ihtMetros.cities[k].label }; });
    items.push({ v: '__other', l: 'Somewhere else' });
    setupFillSelect(sel, items, 'Pick a city');
    setupCitiesFilled = true;
  }
  function setupCurrentRoute() {
    return { cityId: setupCityId || null, city: ($('in-city') && $('in-city').value) || '',
      lineId: setupLineId || null, line: setupLineName || (($('in-line') && $('in-line').value) || ''),
      from: (setupStations && setupFromIdx >= 0) ? setupStations[setupFromIdx] : '',
      dest: ($('in-dest') && $('in-dest').value) || '', stops: setupStops };
  }
  function setupShortcuts() { return readJSON('iht_shortcuts', null) || { home: null, work: null, frequent: [] }; }
  function setupSaveShortcuts(s) { store('iht_shortcuts', JSON.stringify(s)); }
  function setupApplySaved(r, done) {
    if (!r) { return; }
    setupFillCities();
    var citySel = $('sel-city');
    if (r.cityId && window.__ihtMetros && window.__ihtMetros.cities[r.cityId]) {
      citySel.value = r.cityId; setupOnCity();
      var lines = setupMetroLines(), lineId = r.lineId;
      if (!lineId) { lines.forEach(function (l) { if (l.name === r.line) { lineId = l.id; } }); }
      var applyLine = function () {
        var ls = $('sel-line');
        if (ls && lineId) { ls.value = lineId; setupOnLine(); }
        if (setupStations && r.from && r.dest) {
          setupFromIdx = setupStations.indexOf(r.from); setupDestIdx = setupStations.indexOf(r.dest);
          setupFillStopSelects(); setupApplyRoute();
        } else if (r.dest) {
          setupManualMode = true;
          var m = $('setup-manual'); if (m) { m.hidden = false; }
          if ($('in-manual-city')) { $('in-manual-city').value = r.city || ''; }
          if ($('in-manual-dest')) { $('in-manual-dest').value = r.dest; }
          if ($('in-manual-line')) { $('in-manual-line').value = r.line || ''; }
          setupApplyRoute();
        }
        if (done) { done(); }
      };
      /* Always through the load callback: a synchronous apply would run
         before the cached load resolves and lose the station selects. */
      setupLoadStations(r.cityId, applyLine);
    } else {
      citySel.value = '__other'; setupOnCity();
      if ($('in-manual-city')) { $('in-manual-city').value = r.city || ''; }
      if ($('in-manual-line')) { $('in-manual-line').value = r.line || ''; }
      if ($('in-manual-dest')) { $('in-manual-dest').value = r.dest || ''; }
      setupSyncHidden();
      if (done) { done(); }
    }
  }
  function setupRenderShortcuts() {
    var host = $('setup-shortcut-chips'), wrap = $('setup-shortcuts');
    if (!host || !wrap) { return; }
    var s = setupShortcuts(), chips = [];
    host.innerHTML = '';
    function mk(label, fn, saved) {
      var b = document.createElement('button'); b.className = 'flowchip' + (saved ? ' saved' : ''); b.type = 'button';
      b.textContent = label; b.addEventListener('click', function () { tick(); fn(); });
      host.appendChild(b);
    }
    mk(s.home ? 'Home: ' + (s.home.dest || s.home.line || '') : 'Set Home', function () {
      var cur = setupShortcuts();
      if (cur.home) { setupApplySaved(cur.home); }
      else { var r = setupCurrentRoute(); if (r.dest) { cur.home = r; setupSaveShortcuts(cur); setupRenderShortcuts(); } }
    }, !!s.home);
    mk(s.work ? 'Work: ' + (s.work.dest || s.work.line || '') : 'Set Work', function () {
      var cur = setupShortcuts();
      if (cur.work) { setupApplySaved(cur.work); }
      else { var r = setupCurrentRoute(); if (r.dest) { cur.work = r; setupSaveShortcuts(cur); setupRenderShortcuts(); } }
    }, !!s.work);
    (s.frequent || []).forEach(function (f) {
      mk((f.dest || '') + ' (' + (f.line || '') + ')', function () { setupApplySaved(f); });
    });
    var any = !!(s.home || s.work || (s.frequent && s.frequent.length));
    wrap.hidden = !any;
    var rep = $('btn-repeat-ride');
    if (rep) { rep.hidden = !read('iht_last_ride'); }
  }
  function setupEnter() {
    setupFillCities();
    var sel = $('sel-city');
    if (sel && !sel.value) {
      var pre = profile.city || '';
      var cid = pre && window.__ihtMetros ? window.__ihtMetros.cityFor(pre) : null;
      if (cid) {
        sel.value = cid; setupOnCity();
        var pl = profile.line || '';
        if (pl) {
          var lines = setupMetroLines(), lid = null;
          lines.forEach(function (l) { if (l.name === pl) { lid = l.id; } });
          if (lid) { var ls = $('sel-line'); if (ls) { ls.value = lid; setupOnLine(); } }
        }
      } else if (pre) {
        sel.value = '__other'; setupOnCity();
        if ($('in-manual-city')) { $('in-manual-city').value = pre; }
        if ($('in-manual-line')) { $('in-manual-line').value = profile.line || ''; }
        setupSyncHidden();
      }
    }
    setupRenderShortcuts(); setupStopsNote();
    setTimeout(function () {
      tryLocate({ status: $('loc-status'), city: $('in-city'), onceKey: 'setup',
        onFound: function (city) {
          var cid = window.__ihtMetros ? window.__ihtMetros.cityFor(city) : null;
          var st = $('loc-status');
          if (cid) {
            var cs = $('sel-city');
            if (cs && cs.value !== cid) { cs.value = cid; setupOnCity(); }
            if (st) { st.textContent = 'Looks like you are near ' + city + '. I picked it below. Change it if I am wrong.'; }
          } else {
            var cs2 = $('sel-city');
            if (cs2 && !cs2.value) { cs2.value = '__other'; setupOnCity(); if ($('in-manual-city')) { $('in-manual-city').value = city; } setupSyncHidden(); }
            if (st) { st.textContent = 'Looks like you are near ' + city + '. It is not covered yet, so the manual stops below are yours.'; }
          }
        }
      });
    }, 350);
  }
  (function setupWire() {
    var c = $('sel-city'); if (c) { c.addEventListener('change', function () { tick(); setupOnCity(); }); }
    var l = $('sel-line'); if (l) { l.addEventListener('change', function () { tick(); setupOnLine(); }); }
    var f = $('sel-from'); if (f) { f.addEventListener('change', function () { tick(); setupOnStop(); }); }
    var d = $('sel-dest'); if (d) { d.addEventListener('change', function () { tick(); setupOnStop(); }); }
    ['in-manual-city', 'in-manual-line', 'in-manual-dest'].forEach(function (id) {
      var el = $(id); if (el) { el.addEventListener('input', function () { setupInvalidateMap(); setupSyncHidden(); }); }
    });
    var sh = $('btn-save-home'); if (sh) { sh.addEventListener('click', function () { tick(); var s = setupShortcuts(), r = setupCurrentRoute(); if (r.dest) { s.home = r; setupSaveShortcuts(s); setupRenderShortcuts(); } }); }
    var sw = $('btn-save-work'); if (sw) { sw.addEventListener('click', function () { tick(); var s = setupShortcuts(), r = setupCurrentRoute(); if (r.dest) { s.work = r; setupSaveShortcuts(s); setupRenderShortcuts(); } }); }
    var rp = $('btn-repeat-ride'); if (rp) { rp.addEventListener('click', function () { tick(); var r = readJSON('iht_last_ride', null); if (r) { setupApplySaved(r); } }); }
  })();

  /* ---------- location: try first, ask only if needed. Always visible, never silent. ---------- */
  function reverseGeocode(lat, lon, o) {
    fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=en')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var city = d.city || d.locality || '';
        if (city) {
          if (o.city) { o.city.value = city; }
          o.status.textContent = 'Looks like you\u2019re near ' + city + '. Fix it below if I\u2019m wrong — then tell us your line.';
          if (o.onFound) { try { o.onFound(city); } catch (e) {} }
        } else {
          o.status.textContent = 'Found your location, but couldn\u2019t name the city. Fill it in below.';
          if (o.onFail) { try { o.onFail(); } catch (e) {} }
        }
      })
      .catch(function () {
        o.status.textContent = 'Found your location, but the city lookup needs internet. Fill it in below.';
        if (o.onFail) { try { o.onFail(); } catch (e) {} }
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
      if (o.onFail) { try { o.onFail(); } catch (e) {} }
      return;
    }
    st.textContent = 'Trying to find you… (GPS often can\u2019t reach underground — no worries either way.)';
    var done = false;
    function fail(msg) {
      if (done) { return; }
      done = true;
      st.textContent = msg;
      if (o.onFail) { try { o.onFail(); } catch (e) {} }
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
      else { st.textContent = 'Got your location (' + lat + ', ' + lon + ') but you\u2019re offline, so no city name. Fill it in below.'; if (o.onFail) { try { o.onFail(); } catch (e) {} } }
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
  /* v35 ride setup entry: dropdowns prefill from profile, then location
     is attempted once per session (setupEnter handles both). The map
     chooser still mounts into linepick-mount; its pick is reflected back
     into the dropdowns so the visible route and the trip always agree. */
  $all('[data-go="screen-setup"]').forEach(function (b) {
    b.addEventListener('click', function () {
      setupEnter();
      if (window.TriMap && $('linepick-mount')) {
        TriMap.mountChooser($('linepick-mount'), {
          cityEl: $('in-city'),
          profile: profile,
          onDone: function (sel) {
            TriMap.current = sel;
            $('in-line').value = sel.lineName;
            $('in-dest').value = sel.dest;
            window.__ihtSetStops(sel.stopsToGo);
            var ls = $('sel-line'), lines = setupMetroLines(), lid = null;
            lines.forEach(function (l) { if (l.name === sel.lineName) { lid = l.id; } });
            if (ls && lid) {
              ls.value = lid; setupOnLine();
              if (setupStations) {
                var oi = (typeof sel.originIdx === 'number') ? sel.originIdx : -1;
                var di = (typeof sel.destIdx === 'number') ? sel.destIdx : -1;
                if (oi >= 0 && oi < setupStations.length) { setupFromIdx = oi; }
                if (di >= 0 && di < setupStations.length) { setupDestIdx = di; }
                setupFillStopSelects();
                setupStops = sel.stopsToGo; renderSetupStops(); setupStopsNote();
              }
            }
            setupSyncHidden();
          }
        });
      }
    });
  });
  $('stops-minus').addEventListener('click', function () {
    if (window.TriMap) { TriMap.current = null; }
  });
  $('stops-plus').addEventListener('click', function () {
    if (window.TriMap) { TriMap.current = null; }
  });

  /* v35: trip carries its station list so the screen can name stations
     instead of only counting. stations null means the old counter. */
  var trip = { city: '', line: '', dest: '', left: 0, total: 0, from: '', fromIdx: -1, destIdx: -1, stations: null, cityId: null, lineId: null };
  var tripCardSent = false;
  function arrivedNote() {
    petInto($('pet-arrived'), suppressCelebration ? 'idle' : 'celebrate', null, suppressCelebration ? 'idle' : 'celebrate'); // steady, not chirpy, on a second panic
    if (!suppressCelebration) { // v35: arrival sound, only when the celebration itself plays
      try {
        var am = prefs.breathSound || 'chimes';
        if ((am === 'chimes' || am === 'both') && window.__ihtSound) { window.__ihtSound.arrival(); }
      } catch (e) {}
    }
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
    trip.cityId = setupCityId; trip.lineId = setupLineId;
    trip.stations = setupStations || null;
    trip.fromIdx = setupFromIdx; trip.destIdx = setupDestIdx;
    trip.from = (setupStations && setupFromIdx >= 0) ? setupStations[setupFromIdx] : '';
    /* v35: one-tap repeat + frequent stops, on-device only. */
    try {
      var rr = setupCurrentRoute();
      if (rr.dest) {
        store('iht_last_ride', JSON.stringify(rr));
        var sc = setupShortcuts();
        sc.frequent = sc.frequent || [];
        sc.frequent = sc.frequent.filter(function (f) { return !(f.city === rr.city && f.line === rr.line && f.from === rr.from && f.dest === rr.dest); });
        sc.frequent.unshift(rr);
        sc.frequent = sc.frequent.slice(0, 4);
        setupSaveShortcuts(sc);
      }
    } catch (e) {}
    tripCardSent = false;
    tripActive = true;
    applyTheme(); // ride city can differ from home base (hello, Italy)
    var route = (trip.city ? trip.city + ' · ' : '') + (trip.line ? trip.line + ' \u2192 ' : '') + (trip.dest ? trip.dest : 'On your way');
    $('trip-route').textContent = route;
    petInto($('pet-trip'), 'idle', null, checkinFeel === 'spiraling' ? 'worried' : 'idle'); // the co-rider rides along
    renderTripTrain(); // v34: the little train starts at the left
    var nm = (profile.name || '').trim();
    $('trip-fine').textContent = nm
      ? ('One tap per stop, ' + nm + '. That\u2019s all you have to do.')
      : 'One tap per stop. That\u2019s all you have to do.';
    renderStops();
    var showMap = !!(window.TriMap && TriMap.current && TriMap.current.useMap && navigator.onLine);
    $('btn-show-map').hidden = !showMap;
    go('screen-trip');
    /* v35: after go() (which refreshes the generic pet line), set the
       station-aware companion state: names, next stop, tap wording. */
    renderTripStation();
    renderTripPetLine();
    var tap = $('btn-stop-tap');
    if (tap) { tap.textContent = trip.stations ? 'We passed a stop' : 'Tap at each stop'; }
    $('trip-fine').textContent = trip.stations
      ? 'Tap when the train leaves a station. The station names carry the count, so you never have to count.'
      : (nm ? ('One tap per stop, ' + nm + '. That\u2019s all you have to do.') : 'One tap per stop. That\u2019s all you have to do.');
  });

  /* ---------- stop counter: the calm ritual ---------- */
  function renderStops() {
    $('stops-left').textContent = trip.left;
    $('stops-word').textContent = trip.left === 1 ? 'stop to go' : 'stops to go';
    renderTripTrain();
    renderTripStation();
  }
  /* v34: a little train that crawls across the trip screen as stops pass —
     same craft as the intro scene, quiet enough for a ride. */
  function renderTripTrain() {
    var t = $('trip-train'); if (!t) { return; }
    var total = trip.total || 0, left = trip.left || 0;
    var pct = total > 0 ? Math.max(0, Math.min(100, (1 - left / total) * 100)) : 0;
    t.style.left = 'calc(' + pct.toFixed(1) + '% - 32px)'; /* v35: the train graphic is 64px wide now */
  }
  /* The ONE stop counter. Manual taps and the map's auto-advance both
     come through here — never a parallel counter. */
  /* v35: the pet reacts as stops pass. Celebrate per stop, proud when one
     stop is left (near arrival). The reaction lives here so map auto-advance
     and the tap both get it, never a parallel reaction. */
  function advanceStop() {
    buzz(25);
    var n = $('stops-left');
    n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
    if (trip.left > 0) { trip.left--; renderStops(); if (window.__ihtStopHeadsUp) { try { window.__ihtStopHeadsUp(trip.left); } catch (e) {} } } // v26: spoken heads-up at 2 and 1, opt-in only (stopheads.js)
    if (trip.left === 0) {
      if (window.TriMap) { TriMap.closeMap(); }
      setTimeout(function () { arrivedNote(); go('screen-arrived'); }, 600);
    } else if (trip.left === 1) {
      try { petInto($('pet-trip'), 'idle', null, 'proud'); } catch (e) {}
    } else {
      try { petInto($('pet-trip'), 'celebrate', null, 'celebrate'); setTimeout(function () { petInto($('pet-trip'), 'idle'); }, 900); } catch (e) {}
    }
    renderTripPetLine();
  }
  $('btn-stop-tap').addEventListener('click', function () { advanceStop(); });
  $('btn-show-map').addEventListener('click', function () {
    tick();
    var s = window.TriMap && TriMap.current;
    if (!s || !s.useMap) { return; }
    TriMap.openMap($('trimap-mount'), {
      line: s.line,
      originIdx: s.originIdx,
      destIdx: s.destIdx,
      stopsToGo: s.stopsToGo,
      getRemaining: window.__ihtTripLeft,
      onAdvance: function () { advanceStop(); },
      onClose: function () { go('screen-trip'); }
    });
    go('screen-trimap');
  });
  $('btn-end-trip').addEventListener('click', function () {
    tick();
    if (window.TriMap) { TriMap.closeMap(); }
    arrivedNote(); go('screen-arrived'); });

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
  var plan = readJSON('iht_plan', null) || { exit: '', reach: '', reachName: '', reachPhone: '', pocket: ['Water', 'Headphones'], c1: '', c2: '', c3: '' };
  function savePlan(msg) {
    store('iht_plan', JSON.stringify(plan));
    if (msg) { $('plan-saved').textContent = msg; }
  }
  function renderPlan() {
    $('plan-exit').value = plan.exit || '';
    $('plan-reach').value = plan.reach || '';
    $('plan-reach-name').value = plan.reachName || '';
    $('plan-reach-phone').value = plan.reachPhone || '';
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
  [['plan-exit', 'exit'], ['plan-reach', 'reach'], ['plan-reach-name', 'reachName'], ['plan-reach-phone', 'reachPhone'], ['plan-c1', 'c1'], ['plan-c2', 'c2'], ['plan-c3', 'c3']].forEach(function (pair) {
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

  /* ---------- learn tab: "calm facts" (v28). Calm-time only.
     The only entry is the home tile; nothing in the panic flow, crisis screens,
     or tools links here. Reads are written once, curated, cited, and honest:
     coping tools, not treatment. No storage, no network, no accounts. ---------- */
  var LEARN_READS = [
    {
      id: 'wave',
      title: "The wave peaks, then passes",
      hook: "The surge has a shape. It\u2019s not endless.",
      tool: 'breath-box',
      body: [
        "A panic surge is your alarm system misfiring. Adrenaline floods in, your heart pounds, you might feel dizzy, tingly, or like you can\u2019t get enough air. It\u2019s miserable \u2014 and it\u2019s a false alarm.",
        "The diagnostic manuals describe it plainly: a panic attack peaks within minutes. The peak is the worst part of it. After that comes a long, slow slope down, whether you do everything right or nothing at all.",
        "Your job isn\u2019t to fight the wave or fix it. It\u2019s to outlast the peak. Sit down if you can, pick one tool if one sounds bearable, and let the slope do the rest."
      ],
      sources: [
        "DSM-5 (American Psychiatric Association, 2013): panic attacks peak within minutes.",
        "Honesty note: this is the typical pattern \u2014 your experience can differ, and nothing here diagnoses you."
      ]
    },
    {
      id: 'grounding',
      title: "Why 5\u20134\u20133\u20132\u20131 works",
      hook: "It doesn\u2019t argue with the fear. It just moves the searchlight.",
      tool: 'five-senses',
      body: [
        "When panic hits, your attention locks onto threat signals \u2014 mostly your own body. Every heartbeat becomes evidence, every dizzy moment a warning.",
        "5\u20134\u20133\u20132\u20131 gives that attention a different job: five things you can see, four you can hear, three you can feel, two you can smell, one you can taste. One concrete answer at a time.",
        "This is a standard grounding technique used in CBT and trauma care. It works by moving the searchlight off your heartbeat and back onto the room around you \u2014 usually long enough for the surge to lose momentum."
      ],
      sources: [
        "Grounding techniques are described across CBT and trauma literature (e.g. Najavits, L.M., Seeking Safety, 2002)."
      ]
    },
    {
      id: 'breath-science',
      title: "What slow breathing actually does",
      hook: "The exhale is the lever.",
      tool: 'breath-box',
      body: [
        "Slow breathing with a longer out-breath nudges your nervous system toward its calmer side. Heart rate eases. The alarm gets quieter. You don\u2019t need to believe it for it to work.",
        "There\u2019s real evidence behind the shape: a 2023 Stanford study found that five minutes a day of cyclic sighing \u2014 a double inhale through the nose, then one long exhale \u2014 improved mood and lowered breathing rate more than a matched mindfulness meditation.",
        "The breathing tools here borrow that shape. Two honest notes: it helps on some rides and not others, and if paying attention to your breath feels wrong, the grounding tools work without it."
      ],
      sources: [
        "Balban et al. (2023), Cell Reports Medicine \u2014 brief daily cyclic sighing vs mindfulness control (n=114): improved mood, reduced respiratory rate."
      ]
    },
    {
      id: 'thoughts',
      title: "Scary thoughts are predictions, not reports",
      hook: "\u201CI\u2019m going to faint\u201D is a forecast. Check the actual weather.",
      tool: 'thought-check',
      body: [
        "Panic has a favorite move: it takes a sensation and assigns it the worst meaning. A pounding heart becomes \u201Csomething is terribly wrong.\u201D Dizziness becomes \u201CI\u2019m going to collapse.\u201D",
        "In 1986, psychologist David Clark showed this loop is the engine of panic: sensation \u2192 scary meaning \u2192 more adrenaline \u2192 stronger sensation. Naming the loop doesn\u2019t make the sensation vanish \u2014 but it labels it correctly: a prediction, not a diagnosis.",
        "The gentle thought check walks through exactly this: what do I know for sure right now, and what is fear predicting? You don\u2019t have to believe the kinder answer. You just have to ask the question."
      ],
      sources: [
        "Clark, D.M. (1986), \u201CA cognitive approach to panic\u201D, Behaviour Research and Therapy."
      ]
    },
    {
      id: 'repetition',
      title: "Rides get easier with repetition, not force",
      hook: "Your brain learns the route is safe one boring ride at a time.",
      tool: 'confidence-ladder',
      body: [
        "Avoidance is panic\u2019s best friend. Every ride you skip teaches your brain the train was dangerous \u2014 the fear grows in the empty space.",
        "The way back is the opposite: small, repeated approaches. One stop. Then two. Nothing heroic. This is the core idea behind graded exposure in CBT: repeated, manageable contact teaches the alarm system the situation is survivable.",
        "The confidence practice planner exists for exactly this \u2014 tiny, optional steps you choose in calm time. No streaks, no scores, no penalties. Boring rides are the whole point: boring means the lesson landed."
      ],
      sources: [
        "Graded exposure is a core CBT technique for panic and phobias \u2014 small, repeated approaches, never forced."
      ]
    }
  ];
  function getLearn(id) { for (var i = 0; i < LEARN_READS.length; i++) { if (LEARN_READS[i].id === id) { return LEARN_READS[i]; } } return null; }
  function renderLearn() {
    var list = $('learn-list'), read = $('learn-read');
    list.innerHTML = '';
    LEARN_READS.forEach(function (r) {
      var b = document.createElement('button');
      b.className = 'toolcard learnitem';
      b.type = 'button';
      var t = document.createElement('strong'); t.className = 'lt'; t.textContent = r.title; b.appendChild(t);
      var h = document.createElement('em'); h.className = 'lh'; h.textContent = r.hook; b.appendChild(h);
      var m = document.createElement('span'); m.className = 'lm'; m.textContent = '1 min read'; b.appendChild(m);
      b.addEventListener('click', function () { tick(); openLearn(r.id); });
      list.appendChild(b);
    });
    list.hidden = false; read.hidden = true;
    window.scrollTo(0, 0);
  }
  function openLearn(id) {
    var r = getLearn(id); if (!r) { return; }
    var list = $('learn-list'), host = $('learn-read');
    host.innerHTML = '';
    var back = document.createElement('button');
    back.className = 'backlink'; back.type = 'button'; back.textContent = '\u2190 all reads';
    back.addEventListener('click', function () { tick(); renderLearn(); });
    host.appendChild(back);
    var h = document.createElement('h3'); h.className = 'serene learntitle'; h.textContent = r.title; host.appendChild(h);
    var hook = document.createElement('p'); hook.className = 'lede soft'; hook.textContent = r.hook; host.appendChild(hook);
    r.body.forEach(function (p) {
      var el = document.createElement('p'); el.className = 'body'; el.textContent = p; host.appendChild(el);
    });
    var src = document.createElement('div'); src.className = 'learnsrc';
    var sh = document.createElement('p'); sh.className = 'learnsrc-h'; sh.textContent = 'Sources'; src.appendChild(sh);
    r.sources.forEach(function (s) {
      var el = document.createElement('p'); el.textContent = s; src.appendChild(el);
    });
    host.appendChild(src);
    var t = getTool(r.tool);
    if (t) {
      var tb = document.createElement('button');
      tb.className = 'btn calm fullwidth'; tb.type = 'button';
      tb.textContent = 'Try the tool this explains: ' + t.title;
      tb.addEventListener('click', function () { tick(); openTool(r.tool, 'screen-learn'); });
      host.appendChild(tb);
    }
    var fine = document.createElement('p'); fine.className = 'fineprint';
    fine.textContent = 'A short read, not a diagnosis. These are coping tools, not treatment.';
    host.appendChild(fine);
    list.hidden = true; host.hidden = false;
    window.scrollTo(0, 0);
  }
  $all('[data-go="screen-learn"]').forEach(function (b) { b.addEventListener('click', renderLearn); });
  renderLearn();

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
      renderCrisisPerson();
    });
  });
  /* v25: one-tap "Call my person" — optional name + number saved in the backup plan
     (iht_plan.reachName / reachPhone, on-device only). When a usable number is set,
     the crisis screen renders it as the first row, above 988, reusing the existing
     honest "Tapping a number leaves the app" disclosure and tel: sanitization. */
  function renderCrisisPerson() {
    var row = $('crisis-person');
    if (!row) { return; }
    var raw = String(plan.reachPhone || '').slice(0, 30);
    var dial = raw.replace(/[^+\d]/g, '');
    var digits = raw.replace(/\D/g, '');
    var textRow = $('crisis-text');
    if (digits.length >= 7) {
      var name = String(plan.reachName || '').trim().slice(0, 40);
      row.hidden = false;
      row.href = 'tel:' + dial;
      $('crisis-person-label').textContent = name ? 'Call ' + name : 'Call my person';
      $('crisis-person-sub').textContent = 'My backup person · saved on this phone only';
      /* v31 audit: talking is hard mid-panic. Texting is not. One tap sends a
         pre-written text so the rider never has to find words. */
      if (textRow) {
        textRow.hidden = false;
        textRow.href = 'sms:' + dial + '?body=' + encodeURIComponent("I'm having a panic attack on the train. I'm okay. Please stay on the line with me.");
        var tl = $('crisis-text-label');
        if (tl) { tl.textContent = name ? 'Text ' + name : 'Text my person'; }
      }
    } else {
      row.hidden = true;
      row.removeAttribute('href');
      if (textRow) { textRow.hidden = true; textRow.removeAttribute('href'); }
    }
  }
  /* v24: the locale-aware crisis line lives in crisis.js (kept out of app.js so this
     file stays under the GitHub push transport cap). It exposes window.__ihtCrisis. */

  /* onboarding: persistent crisis escape — one tap skips setup (defaults kept) and opens help */
  $all('[data-ob-escape]').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      try { localStorage.setItem('iht_onboarded', '1'); } catch (e) {}
      go('screen-panic');
    });
  });
  /* ---------- onboarding (first launch only, v32): experience first.
       ob0: one guided breath with the pet BEFORE any form field — a new user
       feels the core value within 10 seconds of first open. ob1: one question
       only (city), with an explicit looking / found / couldn't-find state.
       ob2: pet pick AFTER the breath. Line and name live in calm time on home. ---------- */
  var obBreathTimer = null;
  function stopObBreath() {
    if (obBreathTimer) { clearTimeout(obBreathTimer); obBreathTimer = null; }
    var pb = $('pet-ob0');
    if (pb) { pb.style.transition = 'none'; pb.style.transform = 'scale(1, 1)'; pb.style.opacity = '1'; }
  }
  function runObBreath(phases, i) {
    if (currentScreen() !== 'screen-ob0') { return; }
    var p = phases[i % phases.length];
    var w = $('ob0-word');
    if (w) { w.textContent = p.word; }
    var pb = $('pet-ob0');
    if (pb) {
      var grow = (p.k === 'in');
      pb.style.transition = reducedMotion ? 'opacity 1.2s ease' : 'transform ' + p.secs + 's cubic-bezier(.37,0,.63,1)';
      if (reducedMotion) { pb.style.transform = 'none'; pb.style.opacity = grow ? '1' : '0.55'; }
      /* v35 belly breathing: bottom-anchored (v35-flow.css sets the origin),
         so the body visibly expands outward on inhale and settles on exhale.
         The old scale(0.94, 1.2) was a vertical stretch from the center. */
      else { pb.style.transform = grow ? 'scale(1.16, 1.10)' : 'scale(1, 1)'; }
      try { phaseCue(p.k); } catch (e) {}
    }
    if (i + 1 >= phases.length) {
      /* 20 seconds done: the breath lands, then the one question appears. */
      obBreathTimer = setTimeout(function () {
        obBreathTimer = null;
        if (currentScreen() !== 'screen-ob0') { return; }
        var w2 = $('ob0-word'); if (w2) { w2.textContent = 'Nice.'; }
        var ln = $('ob0-line'); if (ln) { ln.textContent = 'That feeling is the whole app. One quick question, then you\u2019re in.'; }
        var b = $('btn-ob0-breathe'); if (b) { b.hidden = true; }
        var n = $('btn-ob0-next'); if (n) { n.hidden = false; }
        var pb2 = $('pet-ob0');
        if (pb2) { pb2.style.transition = 'transform 1s ease'; pb2.style.transform = 'scale(1, 1)'; pb2.style.opacity = '1'; }
      }, p.secs * 1000);
      return;
    }
    obBreathTimer = setTimeout(function () { runObBreath(phases, i + 1); }, p.secs * 1000);
  }
  function resetOb0State() {
    /* Entering the breath screen always resets it: pet mounted, breath offered,
       Next hidden. Otherwise a warm reload or swipe-back could land on a stale
       "Nice." state with an empty pet mount. Idempotent; safe to call twice. */
    stopObBreath();
    /* v35: the guide has OPEN eyes and looks at the rider. The old 'sleepy'
       mount hid the open eyes (pet-sleepy CSS) so the guide breathed with
       its eyes shut. 'idle' keeps open eyes plus the blink loop. */
    try { petInto($('pet-ob0'), 'idle', null, 'idle'); } catch (e) {}
    var ln = $('ob0-line');
    if (ln) { ln.textContent = 'Hi, I\u2019m ' + ((pet && pet.name) || 'Mochi') + '. Let\u2019s take one breath together.'; }
    var w = $('ob0-word'); if (w) { w.textContent = '…'; }
    var b = $('btn-ob0-breathe'); if (b) { b.hidden = false; }
    var n = $('btn-ob0-next'); if (n) { n.hidden = true; }
  }
  function enterOb0() { resetOb0State(); go('screen-ob0'); }
  $('btn-ob0-breathe').addEventListener('click', function () {
    tick();
    try { ensureAudio(); } catch (e) {} // the tap is the gesture: safe to init audio on iOS
    var b = $('btn-ob0-breathe'); if (b) { b.hidden = true; }
    runObBreath([
      { k: 'in', word: 'In…', secs: 4 }, { k: 'out', word: 'Out…', secs: 6 },
      { k: 'in', word: 'In…', secs: 4 }, { k: 'out', word: 'Out…', secs: 6 }
    ], 0);
  });
  $('btn-ob0-next').addEventListener('click', function () { tick(); stopObBreath(); enterOb1(); });
  $('btn-ob0-skip').addEventListener('click', function () { tick(); stopObBreath(); finishOnboarding(); });
  function enterOb1() {
    go('screen-ob1');
    var found = $('ob-loc-found'); if (found) { found.hidden = true; }
    tryLocate({
      status: $('ob-loc-status'), city: $('ob-city'), retry: $('btn-ob-loc-retry'), onceKey: 'ob',
      onFound: function (city) {
        /* Found state is unmistakable: short status + an explicit confirm card. */
        var st = $('ob-loc-status'); if (st) { st.textContent = 'Found you.'; }
        var ft = $('ob-loc-found-text'); if (ft) { ft.textContent = 'Looks like you\u2019re near ' + city + '. Is that right?'; }
        var f = $('ob-loc-found'); if (f) { f.hidden = false; }
      },
      onFail: function () {
        var f = $('ob-loc-found'); if (f) { f.hidden = true; }
      }
    });
  }
  $('btn-ob1-next').addEventListener('click', function () {
    tick();
    profile.city = $('ob-city').value.trim().slice(0, 60);
    saveProfile();
    applyTheme(); // the app dresses for the city as soon as it knows it
    petPreviewOb();
    go('screen-ob2');
  });
  $('btn-ob1-skip').addEventListener('click', function () { tick(); petPreviewOb(); go('screen-ob2'); });
  $('btn-ob-loc-yes').addEventListener('click', function () {
    tick();
    profile.city = $('ob-city').value.trim().slice(0, 60);
    saveProfile();
    applyTheme();
    petPreviewOb();
    go('screen-ob2');
  });
  $('btn-ob-loc-no').addEventListener('click', function () {
    tick();
    var f = $('ob-loc-found'); if (f) { f.hidden = true; }
    var inp = $('ob-city'); if (inp) { try { inp.focus(); } catch (e) {} }
  });

  /* ---------- calm-time setup (v32): line + name live here, never in onboarding.
       One quiet card on home, only when either is missing and never dismissed. ---------- */
  function renderFinishSetup() {
    var card = $('home-finish-setup');
    if (!card) { return; }
    var dismissed = false;
    try { dismissed = localStorage.getItem('iht_setup_deferred') === '1'; } catch (e) {}
    var show = !dismissed && !!read('iht_onboarded') && (!profile.name || !profile.line);
    card.hidden = !show;
    if (!show) { return; }
    var nm = $('in-setup-name'); if (nm && document.activeElement !== nm) { nm.value = profile.name || ''; }
    var ln = $('in-setup-line'); if (ln && document.activeElement !== ln) { ln.value = profile.line || ''; }
  }
  $('btn-setup-save').addEventListener('click', function () {
    tick();
    var nm = $('in-setup-name'); if (nm) { profile.name = nm.value.trim().slice(0, 40); }
    var ln = $('in-setup-line'); if (ln) { profile.line = ln.value.trim().slice(0, 60); }
    saveProfile(); applyProfileToHome(); renderFinishSetup();
  });
  $('btn-setup-dismiss').addEventListener('click', function () {
    tick();
    try { localStorage.setItem('iht_setup_deferred', '1'); } catch (e) {}
    renderFinishSetup();
  });

  /* ---------- home: greet by name, show the rider's usual ride, dress for the city ---------- */
  function applyProfileToHome() {
    var bits = [];
    if (profile.city) { bits.push(profile.city); }
    if (profile.line) { bits.push(profile.line); }
    $('home-ride-line').textContent = bits.length ? bits.join(' · ') : 'Your usual ride';
    applyTheme();
    renderFinishSetup();
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
  /* ---------- v35: removed (see REPORT.md). Breathing sounds live in the
     sound picker above; the pet guides with on-screen text only. ---------- */
  /* boot render happens at the bottom with the pet section, after pet init */
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
      try { if (window.__ihtSound) { window.__ihtSound.setMode(prefs.breathSound); } } catch (e) {}
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

  /* ---------- privacy: move my setup to another browser (v18). Export writes a compact,
     copyable code (and an optional file) with co-rider, name, prefs, reflections, trips,
     plans, and saved links. Import restores it with a confirmation. Everything stays
     on-device; the code never leaves the user's hands. ---------- */
  function collectExport() {
    var data = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('iht_') === 0) { data[k] = localStorage.getItem(k); }
      }
    } catch (e) {}
    return { app: 'i-hate-trains', v: 1, exported: new Date().toISOString(), data: data };
  }
  function ioShow(mode) {
    var ta = $('io-code'), acts = $('io-actions'), msg = $('io-msg');
    if (!ta || !acts || !msg) { return; }
    ta.classList.remove('hidden'); acts.classList.remove('hidden'); msg.classList.remove('hidden');
    $('btn-copy-code').classList.toggle('hidden', mode !== 'export');
    $('btn-download-code').classList.toggle('hidden', mode !== 'export');
    $('btn-restore-code').classList.toggle('hidden', mode !== 'import');
    if (mode === 'export') {
      var code = JSON.stringify(collectExport());
      ta.value = code; ta.focus(); ta.select();
      msg.textContent = 'This is your setup as a code. Copy it or download the file, then import it in your other browser.';
    } else {
      ta.value = ''; ta.focus();
      msg.textContent = 'Paste a setup code above, then tap "Restore from this code".';
    }
  }
  function ioCopy() {
    var ta = $('io-code'), msg = $('io-msg');
    function done(ok) { msg.textContent = ok ? 'Copied. Paste it into the other browser\u2019s import box.' : 'Copy didn\u2019t work — long-press the code and copy it by hand.'; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(function () { done(true); }, function () { done(false); });
      } else { ta.focus(); ta.select(); done(document.execCommand('copy')); }
    } catch (e) { done(false); }
  }
  function ioDownload() {
    var ta = $('io-code'), msg = $('io-msg');
    try {
      var blob = new Blob([ta.value], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'i-hate-trains-setup.txt';
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(a.href); } catch (e) {} }, 600);
      msg.textContent = 'File downloaded. Open it on your other browser and import the code inside.';
    } catch (e) { msg.textContent = 'Download didn\u2019t work on this browser — copy the code instead.'; }
  }
  function ioRestore() {
    var ta = $('io-code'), msg = $('io-msg');
    var payload;
    try { payload = JSON.parse(ta.value); } catch (e) { payload = null; }
    if (!payload || payload.app !== 'i-hate-trains' || !payload.data || typeof payload.data !== 'object') {
      msg.textContent = 'That doesn\u2019t look like an I Hate Trains setup code. Check you pasted the whole thing.';
      return;
    }
    if (!window.confirm('Replace everything on this phone with the imported setup? This can\u2019t be undone.')) { return; }
    try {
      var wrote = 0;
      Object.keys(payload.data).forEach(function (k) {
        if (k.indexOf('iht_') === 0 && typeof payload.data[k] === 'string') {
          localStorage.setItem(k, payload.data[k]); wrote++;
        }
      });
      if (!wrote) { msg.textContent = 'The code held no setup data — nothing was changed.'; return; }
      store('iht_schema_version', String(IHT_SCHEMA_VERSION));
    } catch (e) { msg.textContent = 'Import didn\u2019t work on this browser — nothing was changed.'; return; }
    window.location.reload();
  }
  if ($('btn-export')) { $('btn-export').addEventListener('click', function () { tick(); ioShow('export'); }); }
  if ($('btn-import')) { $('btn-import').addEventListener('click', function () { tick(); ioShow('import'); }); }
  if ($('btn-copy-code')) { $('btn-copy-code').addEventListener('click', function () { tick(); ioCopy(); }); }
  if ($('btn-download-code')) { $('btn-download-code').addEventListener('click', function () { tick(); ioDownload(); }); }
  if ($('btn-restore-code')) { $('btn-restore-code').addEventListener('click', function () { tick(); ioRestore(); }); }
  /* hook so automated checks can exercise export/import without the DOM buttons */
  window.__ihtPortable = { collect: collectExport, restoreText: function (t) { $('io-code').value = t; ioRestore(); } };

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

  /* ============ v31 PET ENGINE — alive, not decorative ============
     Gaze: pupils translate a few pixels toward the last tap, easing back to
     center after 2s. On the panic screen they default to center-forward: the pet
     looks at the rider, never away. Blink: a JS loop (3-6s, randomized) that
     swaps open eyes for shut eyes for 130ms; blinks pause on inhale so the pet
     never looks away mid-breath. All transform/opacity only, GPU-friendly. */
  var gazeResetTimer = null;
  function petGaze(x, y) {
    try {
      var dx = Math.max(-1, Math.min(1, (x - window.innerWidth / 2) / (window.innerWidth / 2)));
      var dy = Math.max(-1, Math.min(1, (y - window.innerHeight / 2) / (window.innerHeight / 2)));
      var r = document.documentElement;
      r.style.setProperty('--px', (dx * 3).toFixed(1) + 'px');
      r.style.setProperty('--py', (dy * 2).toFixed(1) + 'px');
      if (gazeResetTimer) { clearTimeout(gazeResetTimer); }
      gazeResetTimer = setTimeout(function () {
        r.style.setProperty('--px', '0px');
        r.style.setProperty('--py', '0px');
      }, 2000);
    } catch (e) {}
  }
  document.addEventListener('pointerdown', function (e) {
    if (currentScreen() === 'screen-panic') { return; } // panic: eyes forward, always
    try { petGaze(e.clientX, e.clientY); } catch (err) {}
  }, { passive: true });
  (function petBlinkLoop() {
    function schedule() {
      setTimeout(function () {
        if (!petBreathIn && !document.hidden) {
          document.body.classList.add('pet-blink');
          setTimeout(function () { document.body.classList.remove('pet-blink'); }, 130);
        }
        schedule();
      }, 3000 + Math.random() * 3000);
    }
    schedule();
  })();
  /* v10: THE PET — a co-rider. Zero maintenance: no meters, no death, no guilt. Ever. */
  /* v33 PET MODEL — more pets, more customizable, same zero-maintenance promise.
     Species are data, not special cases: each def carries its classic colors, eye
     positions, blush spots, and accessory anchors. Colors are a small shared palette
     (classic = the species' original colors, so existing users see zero change);
     accessories are appearance-only overlays. Migration: old profiles ({type, name})
     gain color 'classic' and accessory 'none' automatically. */
  var PET_SPECIES = ['blob', 'bird', 'cat', 'fox', 'frog', 'panda', 'bunny'];
  var PET_DEFAULTS = { blob: 'Mochi', bird: 'Pip', cat: 'Miso', fox: 'Rusty', frog: 'Fern', panda: 'Bao', bunny: 'Mallow' };
  var PET_SPECIES_LABEL = { blob: 'Blob', bird: 'Bird', cat: 'Cat', fox: 'Fox', frog: 'Frog', panda: 'Panda', bunny: 'Bunny' };
  var PET_PALETTE = {
    mint: { main: '#93d3ab', dark: '#6fb98a' },
    peach: { main: '#f2b880', dark: '#dd9a5c' },
    lilac: { main: '#c3aed6', dark: '#a58cc0' },
    sky: { main: '#9cc8e8', dark: '#7aadd6' },
    butter: { main: '#f2d98c', dark: '#e0c168' }
  };
  var PET_COLOR_ORDER = ['classic', 'mint', 'peach', 'lilac', 'sky', 'butter'];
  var PET_COLOR_SWATCH = { classic: '#93d3ab', mint: '#93d3ab', peach: '#f2b880', lilac: '#c3aed6', sky: '#9cc8e8', butter: '#f2d98c' };
  var PET_ACCESSORIES = ['none', 'hat', 'glasses', 'scarf', 'bow'];
  var PET_ACCESSORY_LABEL = { none: 'None', hat: 'Hat', glasses: 'Glasses', scarf: 'Scarf', bow: 'Bow' };
  var pet = readJSON('iht_pet', null) || { type: 'blob', name: 'Mochi' };
  if (!PET_DEFAULTS[pet.type]) { pet.type = 'blob'; }
  if (!pet.name) { pet.name = PET_DEFAULTS[pet.type]; }
  if (!pet.color) { pet.color = 'classic'; }
  if (!pet.accessory) { pet.accessory = 'none'; }
  function savePet() { store('iht_pet', JSON.stringify(pet)); }
  function petName() { try { return (pet && pet.name) || PET_DEFAULTS[pet.type] || 'Mochi'; } catch (e) { return 'Mochi'; } }
  function petEyesOpen(eyes) {
    var out = '<g class="peye peye-open">';
    eyes.forEach(function (e) {
      out += '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="5.5" fill="#10141b"/><circle cx="' + (e[0] + 2) + '" cy="' + (e[1] - 2) + '" r="1.8" fill="#fff"/>';
    });
    return out + '</g>';
  }
  function petEyesShut(eyes) {
    var out = '<g class="peye-shut">';
    eyes.forEach(function (e) {
      out += '<path d="M' + (e[0] - 6) + ' ' + e[1] + ' q6 5 12 0" stroke="#10141b" stroke-width="3" fill="none" stroke-linecap="round"/>';
    });
    return out + '</g>';
  }
  function petBlush(spots, strength) {
    var st = strength || 1;
    var out = '';
    spots.forEach(function (p) {
      out += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="' + (st >= 1.5 ? 6.5 : 5) + '" ry="3.5" fill="#d98a9e" opacity="' + Math.min(0.9, 0.55 * st).toFixed(2) + '"/>';
    });
    return out;
  }
  function petAccSVG(acc, sp) {
    if (acc === 'hat') {
      var h = sp.hat;
      return '<g transform="rotate(-8 ' + h[0] + ' ' + h[1] + ')"><path d="M' + (h[0] - 17) + ' ' + (h[1] + 8) + ' q17 -24 34 0 Z" fill="#d95f5f"/><ellipse cx="' + h[0] + '" cy="' + (h[1] + 9) + '" rx="22" ry="4.5" fill="#b84a4a"/><circle cx="' + h[0] + '" cy="' + (h[1] - 13) + '" r="3.5" fill="#f2d98c"/></g>';
    }
    if (acc === 'glasses') {
      var out = '';
      sp.eyes.forEach(function (e) {
        out += '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="10.5" fill="rgba(255,255,255,.14)" stroke="#2b2b33" stroke-width="3"/>';
      });
      if (sp.eyes.length > 1) {
        var a = sp.eyes[0], b = sp.eyes[1];
        out += '<path d="M' + (a[0] + 10) + ' ' + a[1] + ' L' + (b[0] - 10) + ' ' + b[1] + '" stroke="#2b2b33" stroke-width="3" stroke-linecap="round"/>';
        out += '<path d="M' + (a[0] - 10) + ' ' + a[1] + ' L' + (a[0] - 18) + ' ' + (a[1] - 2) + ' M' + (b[0] + 10) + ' ' + b[1] + ' L' + (b[0] + 18) + ' ' + (b[1] - 2) + '" stroke="#2b2b33" stroke-width="3" stroke-linecap="round"/>';
      }
      return out;
    }
    if (acc === 'scarf') {
      return '<path d="M28 90 q32 12 64 0 l0 11 q-32 12 -64 0 Z" fill="#d95f5f"/><rect x="82" y="96" width="13" height="19" rx="4" fill="#b84a4a" transform="rotate(12 88 105)"/>';
    }
    if (acc === 'bow') {
      var w = sp.bow;
      return '<g><path d="M' + w[0] + ' ' + w[1] + ' L' + (w[0] - 14) + ' ' + (w[1] - 8) + ' L' + (w[0] - 14) + ' ' + (w[1] + 8) + ' Z" fill="#d95f5f"/><path d="M' + w[0] + ' ' + w[1] + ' L' + (w[0] + 14) + ' ' + (w[1] - 8) + ' L' + (w[0] + 14) + ' ' + (w[1] + 8) + ' Z" fill="#d95f5f"/><circle cx="' + w[0] + '" cy="' + w[1] + '" r="4" fill="#b84a4a"/></g>';
    }
    return '';
  }
  function petResolve(classicMain, classicDark, color) {
    if (!color || color === 'classic' || !PET_PALETTE[color]) { return { main: classicMain, dark: classicDark }; }
    return { main: PET_PALETTE[color].main, dark: PET_PALETTE[color].dark };
  }
  var PET_DEFS = {
    blob: {
      eyes: [[48, 62], [72, 62]], blush: [[37, 72], [83, 72]], hat: [60, 22], bow: [88, 40],
      body: function (c) {
        return '<ellipse cx="60" cy="104" rx="30" ry="7" fill="rgba(0,0,0,.28)"/>'
          + '<path d="M60 22 C36 22 26 44 26 66 C26 90 40 100 60 100 C80 100 94 90 94 66 C94 44 84 22 60 22 Z" fill="' + c.main + '"/>'
          + '<ellipse cx="45" cy="46" rx="10" ry="15" fill="#ffffff" opacity=".16" transform="rotate(-18 45 46)"/>';
      }
    },
    bird: {
      eyes: [[70, 52]], blush: [[60, 62]], hat: [62, 32], bow: [86, 38],
      body: function (c) {
        return '<path d="M30 78 q-16 4 -20 18 q16 2 24 -8 Z" fill="' + c.dark + '"/>'
          + '<circle cx="60" cy="66" r="30" fill="' + c.main + '"/>'
          + '<ellipse cx="42" cy="70" rx="11" ry="17" fill="' + c.dark + '" transform="rotate(14 42 70)"/>'
          + '<ellipse cx="50" cy="52" rx="9" ry="12" fill="#ffffff" opacity=".18" transform="rotate(-16 50 52)"/>'
          + '<path d="M60 62 l13 5 l-13 5 Z" fill="#e8b86f"/>'
          + '<path d="M52 94 l0 9 M68 94 l0 9" stroke="#e8b86f" stroke-width="3" stroke-linecap="round"/>';
      }
    },
    cat: {
      eyes: [[48, 62], [72, 62]], blush: [[37, 72], [83, 72]], hat: [60, 26], bow: [88, 38],
      body: function (c) {
        return '<path d="M90 86 q18 -2 22 -20" stroke="' + c.main + '" stroke-width="9" fill="none" stroke-linecap="round"/>'
          + '<path d="M34 42 L27 16 L49 30 Z" fill="' + c.main + '"/><path d="M86 42 L93 16 L71 30 Z" fill="' + c.main + '"/>'
          + '<path d="M36 35 L31 21 L45 30 Z" fill="' + c.dark + '"/><path d="M84 35 L89 21 L75 30 Z" fill="' + c.dark + '"/>'
          + '<circle cx="60" cy="64" r="30" fill="' + c.main + '"/>'
          + '<path d="M48 40 q3 5 0 10 M60 38 q3 5 0 10 M72 40 q3 5 0 10" stroke="' + c.dark + '" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
          + '<path d="M56 74 h8 l-4 5 Z" fill="#d98a9e"/>'
          + '<path d="M30 66 l-15 -3 M30 73 l-15 3 M90 66 l15 -3 M90 73 l15 3" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".7"/>';
      }
    },
    fox: {
      eyes: [[48, 60], [72, 60]], blush: [[37, 72], [83, 72]], hat: [60, 26], bow: [88, 40],
      body: function (c) {
        return '<path d="M34 44 L28 14 L52 32 Z" fill="' + c.main + '"/><path d="M86 44 L92 14 L68 32 Z" fill="' + c.main + '"/>'
          + '<path d="M36 36 L33 20 L48 31 Z" fill="#fdf6ec"/><path d="M84 36 L87 20 L72 31 Z" fill="#fdf6ec"/>'
          + '<circle cx="60" cy="66" r="30" fill="' + c.main + '"/>'
          + '<ellipse cx="60" cy="79" rx="16" ry="11" fill="#fdf6ec"/>'
          + '<ellipse cx="60" cy="74" rx="4" ry="3.5" fill="#2b2b33"/>'
          + '<path d="M60 78 L60 82" stroke="#2b2b33" stroke-width="2" fill="none" stroke-linecap="round"/>';
      }
    },
    frog: {
      eyes: [[42, 34], [78, 34]], blush: [[30, 74], [90, 74]], hat: [42, 14], bow: [90, 56],
      body: function (c) {
        return '<circle cx="42" cy="34" r="13" fill="' + c.main + '"/><circle cx="78" cy="34" r="13" fill="' + c.main + '"/>'
          + '<circle cx="60" cy="70" r="32" fill="' + c.main + '"/>'
          + '<ellipse cx="60" cy="82" rx="18" ry="13" fill="#ffffff" opacity=".25"/>';
      }
    },
    panda: {
      eyes: [[48, 62], [72, 62]], blush: [[37, 72], [83, 72]], hat: [60, 24], bow: [88, 40],
      body: function (c) {
        var patch = (!c || !c.patch) ? '#2b2b33' : c.patch;
        return '<circle cx="32" cy="40" r="13" fill="' + patch + '"/><circle cx="88" cy="40" r="13" fill="' + patch + '"/>'
          + '<circle cx="60" cy="66" r="30" fill="#f5f2ea"/>'
          + '<ellipse cx="48" cy="62" rx="9" ry="12" fill="' + patch + '" transform="rotate(-15 48 62)"/>'
          + '<ellipse cx="72" cy="62" rx="9" ry="12" fill="' + patch + '" transform="rotate(15 72 62)"/>'
          + '<ellipse cx="60" cy="76" rx="4.5" ry="3.5" fill="' + patch + '"/>';
      }
    },
    bunny: {
      eyes: [[48, 64], [72, 64]], blush: [[37, 74], [83, 74]], hat: [60, 28], bow: [88, 44],
      body: function (c) {
        return '<ellipse cx="40" cy="26" rx="9" ry="24" fill="' + c.main + '" transform="rotate(-10 40 26)"/>'
          + '<ellipse cx="80" cy="26" rx="9" ry="24" fill="' + c.main + '" transform="rotate(10 80 26)"/>'
          + '<ellipse cx="40" cy="28" rx="4.5" ry="16" fill="' + c.dark + '" transform="rotate(-10 40 28)"/>'
          + '<ellipse cx="80" cy="28" rx="4.5" ry="16" fill="' + c.dark + '" transform="rotate(10 80 28)"/>'
          + '<circle cx="60" cy="68" r="28" fill="' + c.main + '"/>'
          + '<path d="M57 74 h6 l-3 4 Z" fill="#d98a9e"/>'
          + '<rect x="57" y="79" width="6" height="6" rx="1.5" fill="#fff" stroke="#e5e0d8"/>';
      }
    }
  };
  var PET_CLASSIC = {
    blob: ['#93d3ab', '#6fb98a'], bird: ['#a9b6e8', '#8a96cc'], cat: ['#e8b86f', '#d9a05f'],
    fox: ['#e89a4a', '#c97a2e'], frog: ['#7cc47f', '#5aa75e'], panda: ['#f5f2ea', '#2b2b33'],
    bunny: ['#f2ede6', '#e8a0b4']
  };
  /* v34 EXPRESSION SYSTEM: the pet is a friend, not a blob. Faces are layered SVG
     (eyes, brows, mouth, wave arm, speech bubble) driven by app state — check-in
     feeling, tool completion, ride events — never random timers. All 7 species
     support every expression. Open-eye expressions keep BOTH eye groups so the
     global blink loop (body.pet-blink) still works; happy/celebrate faces simply
     do not blink, which reads as a smile held. */
  var PET_MOUTH = { blob: [60, 78], bird: [66, 74], cat: [60, 80], fox: [60, 84], frog: [60, 84], panda: [60, 80], bunny: [60, 90] };
  /* v35: blush strength by expression, so joy reads stronger than worry at phone size. */
  var PET_BLUSH = { idle: 1, happy: 1.2, worried: 0.6, proud: 1.1, sleepy: 0.7, celebrate: 1.5, curious: 1, wave: 1.2, excited: 1.6, calm: 1.1 };
  /* v35 BROWS: every open-eyed expression gets brows, shaped by feeling. Raised
     arcs read happy, flat high brows read proud, inner-down slants read worried,
     one raised brow reads curious, low soft lines read calm. */
  function petBrows(expr, sp) {
    if (expr === 'idle' || expr === 'sleepy') { return ''; }
    var out = '<g stroke="#10141b" stroke-width="2.5" stroke-linecap="round" fill="none">';
    sp.eyes.forEach(function (e, i) {
      var x = e[0], y = e[1] - 14;
      if (expr === 'worried') {
        if (sp.eyes.length === 1) { out += '<path d="M' + (x - 9) + ' ' + y + ' L' + (x + 9) + ' ' + y + '"/>'; }
        else if (i === 0) { out += '<path d="M' + (x - 8) + ' ' + y + ' L' + (x + 8) + ' ' + (y + 5) + '"/>'; }
        else { out += '<path d="M' + (x - 8) + ' ' + (y + 5) + ' L' + (x + 8) + ' ' + y + '"/>'; }
      } else if (expr === 'curious') {
        if (i === 0) { out += '<path d="M' + (x - 8) + ' ' + (y - 4) + ' L' + (x + 8) + ' ' + (y - 4) + '"/>'; }
        else { out += '<path d="M' + (x - 8) + ' ' + (y + 1) + ' L' + (x + 8) + ' ' + (y + 1) + '"/>'; }
      } else if (expr === 'proud') {
        out += '<path d="M' + (x - 8) + ' ' + (y - 3) + ' L' + (x + 8) + ' ' + (y - 3) + '"/>';
      } else if (expr === 'calm') {
        out += '<path d="M' + (x - 7) + ' ' + (y + 2) + ' L' + (x + 7) + ' ' + (y + 2) + '"/>';
      } else if (expr === 'excited' || expr === 'celebrate') {
        out += '<path d="M' + (x - 8) + ' ' + y + ' q8 -7 16 0"/>';
      } else {
        out += '<path d="M' + (x - 8) + ' ' + y + ' q8 -5 16 0"/>';
      }
    });
    return out + '</g>';
  }
  /* v35 MOUTHS: one mouth per feeling, drawn by the face (body mouths were
     removed so no pet shows two mouths). Open mouths carry a tongue; worry is
     a wavy frown; curiosity and sleep are small round mouths. */
  function petMouthPath(expr, m) {
    if (!m) { return ''; }
    var x = m[0], y = m[1];
    var st = ' stroke="#10141b" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
    if (expr === 'celebrate') { return '<path d="M' + (x - 9) + ' ' + y + ' q9 11 18 0 Z" fill="#7a2e2e"/><ellipse cx="' + x + '" cy="' + (y + 6) + '" rx="4" ry="2.5" fill="#d98a9e"/>'; }
    if (expr === 'excited') { return '<path d="M' + (x - 10) + ' ' + y + ' q10 13 20 0 Z" fill="#7a2e2e"/><ellipse cx="' + x + '" cy="' + (y + 7) + '" rx="4.5" ry="3" fill="#d98a9e"/>'; }
    if (expr === 'worried') { return '<path d="M' + (x - 8) + ' ' + (y + 2) + ' q8 -7 16 0"' + st; }
    if (expr === 'sleepy') { return '<circle cx="' + x + '" cy="' + (y + 1) + '" r="3.5"' + st; }
    if (expr === 'curious') { return '<circle cx="' + x + '" cy="' + (y + 1) + '" r="4"' + st; }
    if (expr === 'happy') { return '<path d="M' + (x - 9) + ' ' + y + ' q9 8 18 0"' + st; }
    if (expr === 'wave') { return '<path d="M' + (x - 8) + ' ' + y + ' q8 6 16 0"' + st; }
    if (expr === 'proud') { return '<path d="M' + (x - 6) + ' ' + y + ' q6 4 12 0"' + st; }
    if (expr === 'calm') { return '<path d="M' + (x - 6) + ' ' + y + ' q6 3 12 0"' + st; }
    return '<path d="M' + (x - 7) + ' ' + y + ' q7 5 14 0"' + st;
  }
  /* v35 FACE: 10 expressions, all supported on all 7 species. How they differ
     at phone size: happy and celebrate close the eyes into arcs (celebrate
     adds both arms up and a big open mouth); proud keeps eyes open with flat
     high brows; worried shrinks pupils with inner-down brows and a wavy
     frown; sleepy shuts the eyes with Zzz; curious raises one brow with a
     round mouth; excited widens the pupils with high brows, a big open
     mouth and sparkles; calm half-closes the eyes under low soft brows.
     Open-eye expressions keep BOTH eye groups so the global blink loop
     (body.pet-blink) still works; closed faces simply do not blink. */
  function petFace(expr, sp, c, mouth) {
    var known = { idle: 1, happy: 1, worried: 1, proud: 1, sleepy: 1, celebrate: 1, curious: 1, wave: 1, excited: 1, calm: 1 };
    if (!known[expr]) { expr = 'idle'; }
    var out = '';
    if (expr === 'happy' || expr === 'celebrate') {
      out += '<g class="peye peye-happy">';
      sp.eyes.forEach(function (e) {
        out += '<path d="M' + (e[0] - 7) + ' ' + (e[1] + 2) + ' q7 -8 14 0" stroke="#10141b" stroke-width="3" fill="none" stroke-linecap="round"/>';
      });
      out += '</g>';
    } else if (expr === 'sleepy') {
      out += petEyesShut(sp.eyes);
      out += '<g class="pzzz"><text x="92" y="26" font-size="15" font-weight="700" fill="#8a94a6">z</text><text x="101" y="14" font-size="11" font-weight="700" fill="#8a94a6">z</text></g>';
    } else if (expr === 'calm') {
      out += '<g class="peye peye-open">';
      sp.eyes.forEach(function (e) {
        out += '<path d="M' + (e[0] - 7) + ' ' + (e[1] - 1) + ' q7 -6 14 0" stroke="#10141b" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
        out += '<circle cx="' + e[0] + '" cy="' + (e[1] + 2) + '" r="3" fill="#10141b"/><circle cx="' + (e[0] + 1) + '" cy="' + e[1] + '" r="1.2" fill="#fff"/>';
      });
      out += '</g>';
      out += petEyesShut(sp.eyes);
    } else {
      var r = expr === 'worried' ? 4 : expr === 'excited' ? 7 : expr === 'curious' ? 6 : 5.5;
      out += '<g class="peye peye-open">';
      sp.eyes.forEach(function (e) {
        out += '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="' + r + '" fill="#10141b"/><circle cx="' + (e[0] + 2) + '" cy="' + (e[1] - 2) + '" r="1.8" fill="#fff"/>';
      });
      out += '</g>';
      out += petEyesShut(sp.eyes);
    }
    out += petBrows(expr, sp);
    out += petMouthPath(expr, mouth);
    if (expr === 'wave') {
      out += '<g class="parm"><path d="M88 68 q14 -2 15 -20" stroke="' + c.dark + '" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="104" cy="45" r="7" fill="' + c.main + '" stroke="' + c.dark + '" stroke-width="2"/></g>';
    }
    if (expr === 'celebrate') {
      out += '<g class="parm2" stroke="' + c.dark + '" stroke-width="9" fill="none" stroke-linecap="round"><path d="M32 68 q-14 -2 -15 -20"/><path d="M88 68 q14 -2 15 -20"/></g>';
      out += '<g fill="' + c.main + '" stroke="' + c.dark + '" stroke-width="2"><circle cx="16" cy="45" r="7"/><circle cx="104" cy="45" r="7"/></g>';
    }
    if (expr === 'excited' || expr === 'celebrate') {
      out += '<g fill="#f2d98c"><path d="M16 78 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 Z"/><path d="M104 78 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 Z"/></g>';
    }
    return out;
  }
  function petBubbleSVG(text) {
    if (!text) { return ''; }
    var t = String(text).slice(0, 16).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    var w = Math.max(34, t.length * 8 + 18);
    var x = Math.max(2, 60 - w / 2);
    return '<g class="pbubble"><rect x="' + x + '" y="1" width="' + w + '" height="21" rx="10.5" fill="#ffffff" stroke="#e5e0d8"/><path d="M54 22 l6 7 l6 -7 Z" fill="#ffffff" stroke="#e5e0d8" stroke-linejoin="round"/><text x="60" y="16" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1d2430" font-family="inherit">' + t + '</text></g>';
  }
  function petSVG(type, color, accessory, expr, bubble) {
    var sp = PET_DEFS[type] || PET_DEFS.blob;
    var cl = PET_CLASSIC[type] || PET_CLASSIC.blob;
    var c = petResolve(cl[0], cl[1], color);
    if (type === 'panda' && color && color !== 'classic' && PET_PALETTE[color]) { c = { main: '#f5f2ea', dark: PET_PALETTE[color].dark, patch: PET_PALETTE[color].dark }; }
    if (type === 'panda') { c.patch = c.dark; }
    var ex = expr || 'idle';
    return '<svg viewBox="0 0 120 120" class="petsvg pexpr-' + ex + '" data-expr="' + ex + '" aria-hidden="true">'
      + '<g class="pbody">' + sp.body(c) + '</g>'
      + '<g class="pface">' + petFace(ex, sp, c, PET_MOUTH[type] || null) + petBlush(sp.blush, PET_BLUSH[ex] || 1) + '</g>'
      + petAccSVG(accessory || 'none', sp) + petBubbleSVG(bubble) + '</svg>';
  }
  /* tiny hook so automated checks can verify pet rendering without a real browser */
  window.__ihtPetTest = {
    svg: function (t, c, a, e, b) { return petSVG(t, c, a, e, b); },
    exprs: ['idle', 'happy', 'worried', 'proud', 'sleepy', 'celebrate', 'curious', 'wave', 'excited', 'calm'],
    species: PET_SPECIES,
    get: function () { return { type: pet.type, name: pet.name, color: pet.color, accessory: pet.accessory }; }
  };
  function petInto(el, mode, forceType, expr, bubble) {
    if (!el) { return; }
    el.innerHTML = petSVG(forceType || pet.type, pet.color, pet.accessory, expr || 'idle', bubble || null);
    var wrap = (el.closest && el.closest('.pethome,.petstage,.pettrip,.petbreathe,.petarrived,.petprev,.petcomfort,.ps-pet,.petmini,.ps-preview-pet')) || el;
    wrap.classList.remove('pet-idle', 'pet-happy', 'pet-celebrate', 'pet-sleepy', 'pet-wave');
    wrap.classList.add(mode === 'sleepy' ? 'pet-sleepy' : mode === 'celebrate' ? 'pet-celebrate' : 'pet-idle');
    if (expr === 'wave') { wrap.classList.add('pet-wave'); }
  }
  /* v35 TRIP HOOK: the trip screen owns its layout; this is the clean way for
     it (or any caller) to re-render the trip pet with a new expression without
     touching petInto internals. renderTripPet('celebrate') on a stop tap,
     renderTripPet() to settle back to idle. Existing petInto trip call sites
     keep working unchanged. */
  function renderTripPet(expr) {
    var el = $('pet-trip');
    if (!el) { return null; }
    petInto(el, 'idle', null, expr || 'idle');
    return el.innerHTML;
  }
  window.__ihtTripPet = {
    render: renderTripPet,
    element: function () { return $('pet-trip'); }
  };
  window.__ihtPetTest.trip = function (e) { return renderTripPet(e); };
  /* v34: home return greeting — wave + speech bubble, then back to idle. */
  var homeWaveTimer = null;
  function waveHomePet() {
    try {
      var nm = petName();
      petInto($('pet-home-svg'), 'idle', null, 'wave', 'Hi!');
      var cap = document.querySelector('#pet-home .petcap em');
      if (cap) { cap.textContent = nm + ' says hi!'; }
      if (homeWaveTimer) { clearTimeout(homeWaveTimer); }
      homeWaveTimer = setTimeout(function () {
        if (currentScreen() === 'screen-home') { renderHomePet(); }
      }, 2600);
    } catch (e) {}
  }
  /* v35 IDLE LIFE, calm time only: the pet looks around and waves on its own.
     Looking reuses petGaze (pupils shift, then ease back), so no new gaze state.
     Guards: never on the panic screen, never while a breath is running, never
     while the tab is hidden, never under reduced motion for the wave. The
     breathe pet is untouched here: runPhase owns its wrapper transform, and
     v35-pets.css gives #pet-breathe no idle animation, so there is no second
     loop fighting breath sync. */
  var petLookTimer = null, petWaveTimer = null;
  function petIdleLookTick() {
    try {
      var sc = currentScreen();
      if (!document.hidden && sc !== 'screen-panic' && sc !== 'screen-breathe') {
        var dx = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.45);
        var dy = (Math.random() < 0.5 ? -1 : 1) * Math.random() * 0.3;
        petGaze(window.innerWidth / 2 + dx * window.innerWidth / 2, window.innerHeight / 2 + dy * window.innerHeight / 2);
      }
    } catch (e) {}
    petLookTimer = setTimeout(petIdleLookTick, 9000 + Math.random() * 7000);
  }
  function petIdleWaveTick() {
    try {
      var sh = $('pet-sheet');
      var sheetOpen = !!(sh && sh.classList.contains('open'));
      if (!document.hidden && !reducedMotion && !sheetOpen && currentScreen() === 'screen-home') { waveHomePet(); }
    } catch (e) {}
    petWaveTimer = setTimeout(petIdleWaveTick, 45000 + Math.random() * 30000);
  }
  petLookTimer = setTimeout(petIdleLookTick, 9000 + Math.random() * 7000);
  petWaveTimer = setTimeout(petIdleWaveTick, 45000 + Math.random() * 30000);
  /* v27: the eyes-free rescue module (guide.js) needs the pet mount + name, same split pattern as crisis.js / stopheads.js. */
  window.__ihtGuidePet = {
    mount: function (el) { petInto(el, 'sleepy'); },
    name: function () { try { return petName(); } catch (e) { return 'Mochi'; } }
  };
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
    if (petMood === 'proud' && !suppressCelebration) {
      petInto($('pet-home-svg'), 'celebrate', null, 'proud');
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
    renderPetColorDots();
    renderPetAccSegs();
    mountScreenPets();
    petInto($('pet-about'), 'idle');
    renderPetScreenLines();
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
  var PLAY_GREETINGS = [
    'waves at you. Hi!',
    'is so glad you came to play.',
    'wants to show you a trick.',
    'says: the train can wait, let us play.'
  ];
  var playGreetIdx = 0;
  var fireflyTotal = 5, fireflyCaught = 0, fireflyActive = false;
  function openPetPlay(returnTo) {
    petPlayReturn = returnTo || 'screen-home';
    var nm = pet.name || 'Mochi';
    $('petplay-name').textContent = nm;
    var n2 = $('petplay-name2'); if (n2) { n2.textContent = nm; }
    petInto($('petplay-stage'), 'idle', null, 'wave', 'Hi!');
    $('petplay-line').textContent = nm + ' ' + PLAY_GREETINGS[playGreetIdx % PLAY_GREETINGS.length];
    playGreetIdx++;
    setTimeout(function () { if (currentScreen() === 'screen-petplay') { petInto($('petplay-stage'), 'idle'); } }, 2600);
    tick(); go('screen-petplay');
  }
  function petPat() {
    var st = $('petplay-stage');
    petTap(st);
    $('petplay-line').textContent = (pet.name || 'Mochi') + ' ' + PET_LINES[Math.floor(Math.random() * PET_LINES.length)];
  }
  function playSetLine(t) { var l = $('petplay-line'); if (l) { l.textContent = t; } }
  function playSpin() {
    var st = $('petplay-stage'); if (!st) { return; }
    tick();
    var wrap = (st.closest && st.closest('.petstage')) || st;
    wrap.classList.remove('pet-spin'); void wrap.offsetWidth; wrap.classList.add('pet-spin');
    playSetLine((pet.name || 'Mochi') + ' spins around!');
    setTimeout(function () { wrap.classList.remove('pet-spin'); }, 900);
  }
  function playJump() {
    var st = $('petplay-stage'); if (!st) { return; }
    tick();
    petInto(st, 'celebrate', null, 'celebrate');
    playSetLine((pet.name || 'Mochi') + ' jumps for joy!');
    setTimeout(function () { if (currentScreen() === 'screen-petplay') { petInto(st, 'idle'); } }, 1600);
  }
  function playWave() {
    var st = $('petplay-stage'); if (!st) { return; }
    tick();
    petInto(st, 'idle', null, 'wave', 'Hi!');
    playSetLine((pet.name || 'Mochi') + ' waves back!');
    setTimeout(function () { if (currentScreen() === 'screen-petplay') { petInto(st, 'idle'); } }, 2600);
  }
  function playFireflies() {
    var host = $('play-fireflies'); if (!host) { return; }
    tick();
    host.classList.remove('hidden'); host.innerHTML = '';
    fireflyCaught = 0; fireflyActive = true;
    playSetLine('Catch the fireflies! Tap each one.');
    spawnFirefly();
  }
  function spawnFirefly() {
    var host = $('play-fireflies'); if (!host || !fireflyActive) { return; }
    if (fireflyCaught >= fireflyTotal) {
      fireflyActive = false; host.classList.add('hidden');
      petInto($('petplay-stage'), 'celebrate', null, 'celebrate');
      playSetLine('We caught them all! ' + (pet.name || 'Mochi') + ' is very proud.');
      setTimeout(function () { if (currentScreen() === 'screen-petplay') { petInto($('petplay-stage'), 'idle'); } }, 1600);
      return;
    }
    var f = document.createElement('button');
    f.className = 'firefly'; f.setAttribute('aria-label', 'Firefly');
    f.style.left = (8 + Math.random() * 76) + '%';
    f.style.top = (10 + Math.random() * 70) + '%';
    f.addEventListener('click', function () {
      tick(); fireflyCaught++;
      petTap($('petplay-stage'));
      host.innerHTML = '';
      playSetLine(fireflyCaught + ' of ' + fireflyTotal + ' caught…');
      setTimeout(spawnFirefly, 250);
    });
    host.appendChild(f);
  }
  function playSurprise() {
    var acts = [playSpin, playJump, playWave, playFireflies];
    acts[Math.floor(Math.random() * acts.length)]();
  }
  $('btn-play-pet').addEventListener('click', function () { petPat(); });
  $('btn-play-spin').addEventListener('click', function () { playSpin(); });
  $('btn-play-jump').addEventListener('click', function () { playJump(); });
  $('btn-play-wave').addEventListener('click', function () { playWave(); });
  $('btn-play-fireflies').addEventListener('click', function () { playFireflies(); });
  $('btn-play-surprise').addEventListener('click', function () { playSurprise(); });
  /* onboarding: meet your co-rider */
  var obPetType = 'blob';
  var obPetColor = 'classic';
  var obPetAccessory = 'none';
  function petPreviewOb() {
    PET_SPECIES.forEach(function (t) {
      petInto($('ob-pet-' + t), 'idle', t);
    });
  }
  $all('#ob-color-dots .cdot').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      obPetColor = b.getAttribute('data-color');
      $all('#ob-color-dots .cdot').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    });
  });
  $all('#ob-acc-seg .segbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      obPetAccessory = b.getAttribute('data-acc');
      $all('#ob-acc-seg .segbtn').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    });
  });
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
    pet.color = obPetColor;
    pet.accessory = obPetAccessory;
    var nm = ($('ob-pet-name').value || '').trim().slice(0, 24);
    pet.name = nm || PET_DEFAULTS[obPetType];
    savePet();
    try { localStorage.setItem('iht_onboarded', '1'); localStorage.setItem('iht_setup_version', 'v32 experience-first'); } catch (e) {} // v34: setup version note
    applyProfileToHome();
    renderPetEverywhere(); // every mount, not just home — the chosen pet must appear everywhere
    go('screen-home');
  }
  $('btn-ob2-done').addEventListener('click', function () { tick(); finishOnboarding(); });
  $('btn-ob2-skip').addEventListener('click', function () { tick(); obPetType = 'blob'; var i = $('ob-pet-name'); if (i) { i.value = ''; } finishOnboarding(); });
  $('btn-ob2-back').addEventListener('click', function () { tick(); go('screen-ob1'); });
  /* v34: Replay setup — re-runs the v32 experience-first flow WITHOUT deleting
     profile, pet, or history. Only the onboarded flag is cleared. */
  var rb = $('btn-replay-setup');
  if (rb) { rb.addEventListener('click', function () {
    tick();
    try { localStorage.removeItem('iht_onboarded'); } catch (e) {}
    go('screen-ob0');
  }); }
  var svn = $('setup-version-note');
  if (svn) { svn.textContent = 'Setup version: ' + (read('iht_setup_version') || 'v32 experience-first'); }
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
  function mountComfortPet() { petInto($('pet-comfort'), 'idle'); renderPetScreenLines(); }
  ['link-comfort-home', 'tool-comfort'].forEach(function (id) {
    var el = $(id);
    if (el) { el.addEventListener('click', mountComfortPet); }
  });
  /* v35 LIVE PREVIEW: the pet sheet preview pane shows the pet with the
     currently selected species, color, and accessory, and cycles wave, then
     excited, then idle so the rider can review it before leaving the sheet.
     Taps already save to the same iht_pet key as v34 (same fields, same
     migration: old profiles keep color classic and accessory none until the
     rider changes them); the preview only ever renders, it never writes, so
     saving cannot touch history or trip keys. The cycle starts when the
     sheet opens and stops when it closes. */
  var PET_COLOR_LABEL = { classic: 'Classic', mint: 'Mint', peach: 'Peach', lilac: 'Lilac', sky: 'Sky', butter: 'Butter' };
  var petPreviewTimer = null, petPreviewStep = 0;
  function petPreviewShow() {
    var el = $('ps-preview-pet');
    if (!el) { return; }
    var seq = ['wave', 'excited', 'idle'];
    var ex = seq[petPreviewStep % seq.length];
    if (reducedMotion && ex === 'wave') { ex = 'happy'; }
    petInto(el, 'idle', null, ex, ex === 'wave' ? 'Hi!' : null);
    var note = $('ps-preview-note');
    if (note) {
      note.textContent = (pet.name || 'Mochi') + ' · ' + (PET_SPECIES_LABEL[pet.type] || 'Blob')
        + ' · ' + (PET_COLOR_LABEL[pet.color] || 'Classic')
        + ' · ' + (PET_ACCESSORY_LABEL[pet.accessory] || 'None');
    }
  }
  function renderPetPreview() {
    var sh = $('pet-sheet');
    if (!sh || !sh.classList.contains('open')) { return; }
    petPreviewShow();
  }
  function startPetPreviewCycle() {
    stopPetPreviewCycle();
    petPreviewStep = 0;
    petPreviewShow();
    petPreviewTimer = setInterval(function () {
      var sh = $('pet-sheet');
      if (sh && sh.classList.contains('open') && !document.hidden) { petPreviewStep++; petPreviewShow(); }
    }, 3600);
  }
  function stopPetPreviewCycle() {
    if (petPreviewTimer) { clearInterval(petPreviewTimer); petPreviewTimer = null; }
  }
  function openPetSheet() {
    try { clearPanicFreeze(); } catch (e) {}
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
    requestAnimationFrame(function () { requestAnimationFrame(function () { sh.classList.add('open'); startPetPreviewCycle(); }); });
    petTap($('pet-sheet-svg')); // a little hello
  }
  function closePetSheet() {
    stopPetPreviewCycle();
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
    renderPetPreview();
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
  function setPetColor(c) {
    if (!c || PET_COLOR_ORDER.indexOf(c) === -1) { return; }
    pet.color = c;
    savePet();
    renderPetColorDots();
    renderPetEverywhere();
  }
  function setPetAccessory(a) {
    if (!a || PET_ACCESSORIES.indexOf(a) === -1) { return; }
    pet.accessory = a;
    savePet();
    renderPetAccSegs();
    renderPetEverywhere();
  }
  function renderPetColorDots() {
    $all('.colordots .cdot').forEach(function (b) {
      var on = b.getAttribute('data-color') === pet.color;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderPetPreview();
  }
  function renderPetAccSegs() {
    $all('.accseg .segbtn').forEach(function (b) {
      var on = b.getAttribute('data-acc') === pet.accessory;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderPetPreview();
  }
  /* v33 PET EVERYWHERE — the pet is the guide of the whole app, not decoration.
     Each screen below gets a small pet mount (tap opens the pet sheet) plus a
     contextual one-line reaction from the pet. Panic is the exception: the pet
     sits silent and forward-facing (frozen layout, no new words). */
  var PET_SCREEN_LINES = {
    toolkit: ['Pick one. Any one is enough.', 'No rush. Browse, then pick what feels kind.', 'I am right here while you look.'],
    learn: ['Tiny reads, for between rides.', 'Knowing what panic does makes it less scary.', 'Read one, then try its tool.'],
    plan: ['Set this while you are calm. Future-you says thanks.', 'One glance when you are not. That is the whole job.'],
    history: ['Look what you got through.', 'Every ride here is one you finished.'],
    privacy: ['Everything here stays on this phone. Just us.', 'No accounts. No tracking. Just you and me.'],
    checkin: ['I am ready when you are.', 'However you feel is a fine place to start.'],
    reflect: ['You did it. That is enough.', 'How was that, really? No grade, just noticing.'],
    crisis: ['I am right here with you.', 'You do not have to ride this out alone.'],
    nonbreath: ['No breath required. These work differently, and they work.', 'Counting is not the only way. Pick what feels possible.']
  };
  var PET_SCREEN_MOUNTS = {
    'screen-toolkit': 'pet-toolkit', 'screen-learn': 'pet-learn', 'screen-plan': 'pet-plan',
    'screen-history': 'pet-history', 'screen-privacy': 'pet-privacy', 'screen-checkin': 'pet-checkin',
    'screen-reflect': 'pet-reflect', 'screen-crisis': 'pet-crisis', 'screen-nonbreath': 'pet-nonbreath'
  };
  function renderPetScreenLines() {
    var nm = petName();
    var hr = $('home-cute-pet'); if (hr) { hr.textContent = nm; } // v34: pet-recommended cute row
    var cr = $('comfort-rec-pet'); if (cr) { cr.textContent = nm; } // v34: pet-recommended banner
    Object.keys(PET_SCREEN_LINES).forEach(function (key) {
      var el = $('petline-' + key);
      if (!el) { return; }
      var lines = PET_SCREEN_LINES[key];
      el.textContent = nm + ' says: ' + lines[Math.floor(Math.random() * lines.length)];
    });
    var cl = $('petline-comfort');
    if (cl) { cl.textContent = nm + ' is watching with you.'; }
    var tl = $('petline-trip');
    if (tl) { tl.textContent = nm + ' is riding with you.'; }
  }
  function mountScreenPets() {
    Object.keys(PET_SCREEN_MOUNTS).forEach(function (screen) {
      var ex = (screen === 'screen-toolkit' || screen === 'screen-learn') ? 'curious' : 'idle'; // v34: curious face where you learn
      petInto($(PET_SCREEN_MOUNTS[screen]), 'idle', null, ex);
    });
    petInto($('pet-panic'), 'idle');
  }
  /* v35: station names on the trip screen. Current station is derived from
     stops passed (total minus left), so it can never drift from the count.
     Without station data both lines stay empty and the counter stands. */
  function renderTripStation() {
    var now = $('trip-now'), next = $('trip-next');
    var tf = $('trip-track-from'), tt = $('trip-track-to');
    try {
      if (tf) { tf.textContent = trip.from || ''; }
      if (tt) { tt.textContent = trip.dest || ''; }
    } catch (e) {}
    if (!now || !next) { return; }
    try {
      if (trip.stations && trip.fromIdx >= 0 && trip.destIdx >= 0 && window.IHTStations) {
        var passed = (trip.total || 0) - (trip.left || 0);
        var cur = window.IHTStations.stationAt(trip.stations, trip.fromIdx, trip.destIdx, passed);
        var nxt = trip.left > 0 ? window.IHTStations.stationAt(trip.stations, trip.fromIdx, trip.destIdx, passed + 1) : null;
        now.textContent = cur ? 'Now at ' + cur : '';
        next.textContent = trip.left === 0 ? 'You are here. Well done.' : (nxt ? 'Next: ' + nxt : '');
      } else { now.textContent = ''; next.textContent = ''; }
    } catch (e) { now.textContent = ''; next.textContent = ''; }
  }
  function renderTripPetLine() {
    var tl = $('petline-trip');
    if (!tl) { return; }
    var nm = petName();
    try {
      var left = (typeof trip !== 'undefined' && trip) ? trip.left : null;
      if (left === 1) { tl.textContent = nm + ' says: next stop is yours. You have got this.'; }
      else if (left === 2) { tl.textContent = nm + ' says: two stops to go. Almost there.'; }
      else if (trip.stations && trip.fromIdx >= 0 && trip.destIdx >= 0 && window.IHTStations) {
        var passed = (trip.total || 0) - (trip.left || 0);
        var nxt = window.IHTStations.stationAt(trip.stations, trip.fromIdx, trip.destIdx, passed + 1);
        tl.textContent = nxt ? nm + ' is riding with you. Next: ' + nxt + '.' : nm + ' is riding with you.';
      }
      else { tl.textContent = nm + ' is riding with you.'; }
    } catch (e) { tl.textContent = nm + ' is riding with you.'; }
  }
  $all('.petmini').forEach(function (b) {
    b.addEventListener('click', function () { tick(); openPetSheet(); });
  });

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
  (function () {
    var pv = $('ps-preview-pet');
    if (pv) { pv.addEventListener('click', function () { petTap(pv); }); }
  })();
  $('ps-play').addEventListener('click', function () { closePetSheet(); setTimeout(function () { openPetPlay(petSheetReturn); }, 140); });
  $('ps-pick').addEventListener('click', function () { closePetSheet(); setTimeout(petPicks, 140); });
  $('ps-name').addEventListener('change', function () { setPetName($('ps-name').value); });
  $all('#ps-pet-seg .segbtn').forEach(function (b) {
    b.addEventListener('click', function () { tick(); setPetType(b.getAttribute('data-pet')); });
  });
  $all('.colordots .cdot').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      if (b.closest && b.closest('#ob-color-dots')) { return; } // onboarding has its own handler
      setPetColor(b.getAttribute('data-color'));
    });
  });
  $all('.accseg .segbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      tick();
      if (b.closest && b.closest('#ob-acc-seg')) { return; } // onboarding has its own handler
      setPetAccessory(b.getAttribute('data-acc'));
    });
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
      { key: 'tools', sel: '#toolkit-groups .toolcard', title: 'Hands-on tools', body: 'These you do with your fingers — no reading required.' }
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

  /* ---------- app updates (v18): the phone must actually receive new versions.
     The service worker installs in the background and waits; we show one calm banner on
     safe screens only (home, settings, about, history, plan) — never on breathing, panic,
     trip, or any tool screen. Tapping "Update when you're ready" activates the new worker
     and reloads. If the SW never updates (offline), the banner simply never appears. ---------- */
  var UPDATE_SAFE_SCREENS = { 'screen-home': 1, 'screen-privacy': 1, 'screen-about': 1, 'screen-history': 1, 'screen-plan': 1, 'screen-learn': 1 };
  var pendingUpdateApply = null;
  function maybeShowUpdateBanner() {
    var b = $('update-banner');
    if (!b) { return; }
    var show = !!pendingUpdateApply && !!UPDATE_SAFE_SCREENS[currentScreen()];
    b.classList.toggle('hidden', !show);
  }
  function armUpdatePrompt(applyFn) {
    pendingUpdateApply = applyFn;
    maybeShowUpdateBanner();
  }
  (function watchForUpdates() {
    if (!('serviceWorker' in navigator)) { return; }
    function onWaiting(reg) {
      if (!reg.waiting) { return; }
      armUpdatePrompt(function () { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); });
    }
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        if (reg.waiting) { onWaiting(reg); return; }
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) { return; }
          nw.addEventListener('statechange', function () {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) { onWaiting(reg); }
          });
        });
      }).catch(function () { /* offline-first: a failed registration never blocks the app */ });
    });
    var reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloadedForUpdate) { return; }
      reloadedForUpdate = true;
      window.location.reload();
    });
  })();
  var _btnUpdateNow = $('btn-update-now');
  if (_btnUpdateNow) { _btnUpdateNow.addEventListener('click', function () { tick(); if (pendingUpdateApply) { pendingUpdateApply(); } }); }
  /* tiny hook so automated checks can verify the update wiring without a real service worker */
  window.__ihtUpdate = { arm: armUpdatePrompt, refresh: maybeShowUpdateBanner, safe: UPDATE_SAFE_SCREENS, go: go };

  /* ---------- v31 start screen: a loading screen meets a sitcom intro ----------
     2.0-2.5s on a normal cold open, 1.2s when the rider already opened the app
     3+ times today, pet-only 0.8s after the first week (audit frequency cap).
     Skippable after 1s; the panic button works from 0.0s and skips the rest.
     Warm resume (same tab session) skips the intro entirely. The motif is an
     original 4-note figure synthesized with Web Audio: no files, no licenses,
     offline by construction. If iOS blocks audio before a gesture, the intro is
     still complete silent — the pet and the name carry it. */
  function splashMotif() {
    try {
      if (window.__ihtSound) { // v35: same 4-note motif character, from sound.js
        try { if (window.__ihtSound.motif()) { return; } } catch (e) {}
      }
      var ctx = ensureAudio();
      if (!ctx) { return; }
      if (ctx.state === 'suspended') { ctx.resume(); }
      var t0 = ctx.currentTime + 0.05;
      var notes = [523.25, 659.25, 783.99, 659.25]; // C5 E5 G5 E5: a warm rise and resolve
      notes.forEach(function (f, i) {
        var t = t0 + i * 0.32;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.55);
      });
      var pad = ctx.createOscillator(), pg = ctx.createGain(); // warm low pad underneath
      pad.type = 'triangle'; pad.frequency.value = 261.63;
      pg.gain.setValueAtTime(0.0001, t0);
      pg.gain.exponentialRampToValueAtTime(0.02, t0 + 0.3);
      pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      pad.connect(pg); pg.connect(ctx.destination);
      pad.start(t0); pad.stop(t0 + 1.65);
    } catch (e) {} // silent intro is still complete: never fail boot on audio
  }
  function splashMode() {
    /* returns { ms, short } — short means pet-only, no name fade. */
    try {
      var now = Date.now();
      var st = readJSON('iht_splash', null) || {};
      if (!st.first) { st.first = now; }
      var today = new Date().toDateString();
      st.count = (st.date === today) ? (st.count || 0) + 1 : 1;
      st.date = today;
      store('iht_splash', JSON.stringify(st));
      if (now - st.first > 7 * 24 * 3600 * 1000) { return { ms: 800, short: true }; }
      if (st.count >= 3) { return { ms: 1200, short: false }; }
      return { ms: 2200, short: false };
    } catch (e) { return { ms: 2200, short: false }; }
  }
  function dismissSplash(target) {
    if (!splashActive) { return; }
    clearSplashTimers();
    if (!target) { return; }
    if (target === 'screen-ob0') { enterOb0(); return; } // first launch: breath first, then setup
    go(target);
  }
  function showSplash(target) {
    var mode = splashMode();
    try { petInto($('ts-pet'), 'idle'); } catch (e) {}
    try { var tr = $('ts-train'); if (tr) { tr.style.animationDuration = mode.ms + 'ms, .55s'; } } catch (e) {}
    var nm = $('splash-name');
    if (nm) { nm.style.display = mode.short ? 'none' : 'block'; }
    splashActive = true;
    var started = Date.now();
    go('screen-splash');
    splashActive = true; // go() clears timers; re-arm after navigation
    splashMotif();
    splashTimer = setTimeout(function () { dismissSplash(target); }, mode.ms);
    var splashEl = $('screen-splash');
    if (splashEl) {
      splashEl.addEventListener('pointerdown', function (e) {
        if (e.target && e.target.id === 'btn-splash-panic') { return; } // panic has its own handler
        if (Date.now() - started >= 1000) { dismissSplash(target); }
      });
    }
  }
  (function () {
    var b = $('btn-splash-panic');
    if (!b) { return; }
    b.addEventListener('click', function () {
      tick();
      clearSplashTimers();
      go('screen-panic');
    });
  })();

  /* ---------- boot: splash on cold open, then onboarding or home. Coach marks guide from there. ---------- */
  applyProfileToHome();
  renderHomePet();
  petInto($('pet-breathe'), 'sleepy');
  renderBreatheCap();
  if (window.__ihtCrisis) { window.__ihtCrisis.renderQuiet(); window.__ihtCrisis.renderLocale(); } // v24: locale-aware crisis line (crisis.js)
  (function boot() {
    var target = read('iht_onboarded') ? 'screen-home' : 'screen-ob0';
    var warm = false;
    try { warm = !!sessionStorage.getItem('iht_session'); sessionStorage.setItem('iht_session', '1'); } catch (e) {}
    if (warm) { go(target); return; }
    showSplash(target);
  })();

})();
