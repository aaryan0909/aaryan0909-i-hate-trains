/* I Hate Trains v42 — calm-time additions + "Resume the wave".
   Separate module (same pattern as guide.js / crisis.js) so app.js,
   which is over the single-push size cap, is never touched.
   Rules held by this module:
   - FREE FOREVER: no paywall, premium, Stripe, or ads anywhere.
   - NO VOICE: sound comes only from the v35 sound pack
     (window.__ihtSound: motif / tap). Never spoken synthesis.
   - Panic/crisis screens are untouched. This module never writes
     into #screen-panic, #screen-crisis, #screen-breathe, #screen-guide,
     or #screen-senses; it only READS which screen is active so it can
     remember an in-progress panic tool, and it resumes by clicking
     the panic screen's own existing buttons.
   - No scores, no streaks, no grades. Sensation ratings live only
     for the current exercise and are never stored.
   - One storage key: iht_resume_wave (tool + phase + timestamp,
     on-device only, same pattern as iht_last_ride). Nothing leaves
     the phone. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function readJSON(k, fb) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function remove(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var KEY = 'iht_resume_wave';
  var HOUR = 60 * 60 * 1000;
  var petName = 'Mochi';
  try { var p = readJSON('iht_pet', null); if (p && p.name) { petName = p.name; } } catch (e) {}

  /* ---------- shared helpers ---------- */
  function showScreen(id) {
    $all('.screen').forEach(function (s) { s.classList.remove('active'); });
    var el = $(id);
    if (el) { el.classList.add('active'); }
    try { window.scrollTo(0, 0); } catch (e) {}
  }
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
  function setPetNames() {
    $all('.calm42-petname').forEach(function (el) { el.textContent = petName; });
  }

  /* ================= 1. RESUME THE WAVE ================= */
  var TOOLS = {
    'screen-breathe': { tool: 'breathe', label: 'breathing', btn: 'btn-panic-breathe', cta: 'back to breathing?' },
    'screen-senses': { tool: 'grounding', label: 'grounding', btn: 'btn-panic-ground', cta: 'back to grounding?' },
    'screen-guide': { tool: 'rescue', label: 'guided rescue', btn: 'btn-panic-guide', cta: 'back to the guided rescue?' }
  };
  var CLEAR_ON = { 'screen-reentry': 1, 'screen-arrived': 1 };
  var hadAtLoad = null, resumeShown = false, resumeDismissed = false, suppressRecord = false;

  function readResume() {
    var r = readJSON(KEY, null);
    if (!r || !r.tool || !r.savedAt) { return null; }
    if (Date.now() - r.savedAt >= HOUR) { remove(KEY); return null; }
    return r;
  }
  function record(tool, phase) {
    if (suppressRecord) { return; }
    store(KEY, JSON.stringify({ tool: tool, phase: phase || 'in progress', savedAt: Date.now() }));
  }
  function currentTool() {
    var a = document.querySelector('.screen.active');
    return a ? TOOLS[a.id] : null;
  }
  function phaseText() {
    var w = $('breath-word'); if (w && w.textContent && w.textContent.trim() && w.textContent.trim() !== '…') { return w.textContent.trim(); }
    var s = $('sen-stage-label'); if (s && s.textContent) { return s.textContent.trim(); }
    return 'in progress';
  }
  function maybeShowResume() {
    if (resumeShown || resumeDismissed || !hadAtLoad) { return; }
    var home = $('screen-home');
    if (!home || !home.classList.contains('active')) { return; }
    var r = readResume();
    if (!r) { return; }
    var card = $('resume-wave-card'); if (!card) { return; }
    var t = null;
    Object.keys(TOOLS).forEach(function (k) { if (TOOLS[k].tool === r.tool) { t = TOOLS[k]; } });
    if (!t) { return; }
    var cta = $('resume-wave-cta'); if (cta) { cta.textContent = 'Still with you — ' + t.cta; }
    card.hidden = false; resumeShown = true;
  }
  function resumeNow() {
    var r = readResume();
    var card = $('resume-wave-card'); if (card) { card.hidden = true; }
    if (!r) { return; }
    var t = null;
    Object.keys(TOOLS).forEach(function (k) { if (TOOLS[k].tool === r.tool) { t = TOOLS[k]; } });
    if (!t) { return; }
    remove(KEY); resumeDismissed = true;
    var btn = $(t.btn);
    if (btn) { try { btn.click(); return; } catch (e) {} }
    // Fallback if the panic button is ever missing: land on the panic
    // screen itself (its own buttons are the resume path from there).
    showScreen('screen-panic');
  }
  function dismissResume() {
    remove(KEY); resumeDismissed = true;
    var card = $('resume-wave-card'); if (card) { card.hidden = true; }
  }
  hadAtLoad = readResume();

  var screenObserver = null;
  try {
    screenObserver = new MutationObserver(function () {
      var a = document.querySelector('.screen.active');
      if (!a) { return; }
      if (CLEAR_ON[a.id]) { remove(KEY); }
      else if (TOOLS[a.id]) { record(TOOLS[a.id].tool, phaseText()); }
      if (a.id === 'screen-home') { maybeShowResume(); }
    });
    $all('.screen').forEach(function (s) {
      screenObserver.observe(s, { attributes: true, attributeFilter: ['class'] });
    });
    var phaseObserver = new MutationObserver(function () {
      var t = currentTool();
      if (t) { record(t.tool, phaseText()); }
    });
    ['breath-word', 'sen-stage-label'].forEach(function (id) {
      var el = $(id);
      if (el) { phaseObserver.observe(el, { childList: true, characterData: true, subtree: true }); }
    });
  } catch (e) { /* observer unavailable: resume still works from the load-time record */ }

  /* ================= 2. MAKE FRIENDS WITH THE SENSATION =================
     Calm-time only. Entered only from Learn (never the panic screen).
     Three short practices, each: rate before (0-10) -> do it -> rate
     after -> a plain comparison. Ratings are session-only, never stored,
     never scored, never streaked. Practice, not treatment. */
  var SEN = {
    'breathe-faster': { title: 'Breathe a little faster', kind: 'timer' },
    'stand-sit': { title: 'Stand up, sit down, quickly', kind: 'count' },
    'hold-breath': { title: 'Hold a breath', kind: 'hold' }
  };
  var sen = { ex: null, before: null, after: null, timer: null, left: 30, cueIn: true, count: 0, held: 0 };
  function senStage(id) {
    ['sen42-pick', 'sen42-before', 'sen42-do', 'sen42-after', 'sen42-done'].forEach(function (s) {
      var el = $(s); if (el) { el.hidden = (s !== id); }
    });
  }
  function senClear() { if (sen.timer) { clearInterval(sen.timer); sen.timer = null; } }
  function rateGrid(hostId, onPick) {
    var host = $(hostId); if (!host || host.children.length) { return; }
    for (var i = 0; i <= 10; i++) {
      (function (n) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'calm42-rate'; b.textContent = String(n);
        b.setAttribute('aria-label', 'Scary rating ' + n + ' out of 10');
        b.addEventListener('click', function () { onPick(n); });
        host.appendChild(b);
      })(i);
    }
  }
  function senPick(id) {
    sen.ex = id; sen.before = null; sen.after = null; senClear();
    var t = $('sen42-before-title'); if (t) { t.textContent = SEN[id].title; }
    var q = $('sen42-before-q'); if (q) { q.textContent = 'Before you start: how scary does this sensation feel right now, 0 to 10? 0 is not scary at all, 10 is the scariest.'; }
    rateGrid('sen42-before-grid', function (n) { sen.before = n; senStart(); });
    senStage('sen42-before');
  }
  function senStart() {
    senStage('sen42-do');
    var ex = SEN[sen.ex];
    var title = $('sen42-do-title'); if (title) { title.textContent = ex.title; }
    var body = $('sen42-do-body'); if (body) { body.textContent = senDoCopy(); }
    var big = $('sen42-do-big'); if (big) { big.textContent = ex.kind === 'timer' ? '30' : ex.kind === 'count' ? '0' : '0s'; }
    var cue = $('sen42-do-cue'); if (cue) { cue.textContent = ex.kind === 'timer' ? 'Breathe in…' : ex.kind === 'count' ? 'Only if it feels safe to stand. Sit back down whenever.' : 'Take a normal breath in, then hold. Let go the moment it feels uncomfortable.'; }
    var act = $('sen42-do-action'); if (act) { act.textContent = ex.kind === 'count' ? 'I stood up and sat down' : ex.kind === 'hold' ? 'Let go' : 'Stop'; }
    senClear();
    sound('start', 'sen42-ind');
    if (ex.kind === 'timer') {
      sen.left = 30; sen.cueIn = true;
      sen.timer = setInterval(function () {
        sen.left -= 1;
        var b2 = $('sen42-do-big'); if (b2) { b2.textContent = String(Math.max(sen.left, 0)); }
        if (sen.left % 2 === 0) {
          sen.cueIn = !sen.cueIn;
          var c = $('sen42-do-cue'); if (c) { c.textContent = sen.cueIn ? 'Breathe in…' : '…and out.'; }
          sound('tap', 'sen42-ind');
        }
        if (sen.left <= 0) { senClear(); senAfter(); }
      }, 1000);
    } else if (ex.kind === 'hold') {
      sen.held = 0;
      sen.timer = setInterval(function () {
        sen.held += 1;
        var b3 = $('sen42-do-big'); if (b3) { b3.textContent = sen.held + 's'; }
      }, 1000);
    } else { sen.count = 0; }
  }
  function senDoCopy() {
    if (sen.ex === 'breathe-faster') { return 'Breathe a little faster than usual for 30 seconds — not hard, not forced. Just quicker. The timer and the chime keep the pace. Stop any time.'; }
    if (sen.ex === 'stand-sit') { return 'Stand up, then sit straight back down, a bit quicker than usual. That light-headed rush is the sensation to notice. Only do this where you can sit safely, and skip it if you feel dizzy.'; }
    return 'Take a normal breath in and hold it. Do not push past comfort — let go the moment it feels uncomfortable, and breathe normally again.';
  }
  function senAfter() {
    senClear();
    var t = $('sen42-after-title'); if (t) { t.textContent = SEN[sen.ex].title; }
    rateGrid('sen42-after-grid', function (n) {
      sen.after = n;
      var r = $('sen42-done-text');
      if (r) {
        var d = sen.before - n;
        var line = 'Before: ' + sen.before + ' · After: ' + n + '. ';
        line += (d > 0) ? 'That felt a little less scary after trying it.' : (d < 0) ? 'That felt a little scarier — that happens, and it is still useful information.' : 'About the same. Nothing to fix, nothing to grade.';
        r.textContent = line;
      }
      senStage('sen42-done');
    });
    senStage('sen42-after');
  }
  function senAction() {
    if (!sen.ex) { return; }
    var kind = SEN[sen.ex].kind;
    if (kind === 'count') {
      sen.count += 1;
      var b = $('sen42-do-big'); if (b) { b.textContent = String(sen.count); }
      var c = $('sen42-do-cue'); if (c) { c.textContent = sen.count === 1 ? 'One done. Notice the rush, then sit and breathe normally.' : sen.count + ' done. Finish whenever you like.'; }
      sound('tap', 'sen42-ind');
    } else { senAfter(); }
  }

  /* ================= 3. BODY SCAN, PET-LED =================
     Calm-time only, entered only from Learn. Attention inward,
     feet to head, one body part per card. A soft chime from the
     v35 sound pack sounds on each step, with a visible playing
     indicator. Zero voice. Distinct from 5-4-3-2-1 (outward senses). */
  var SCAN = [
    { part: 'Feet', prompt: 'Notice your feet. Warmth, pressure from the floor, tingling, or nothing much at all. No need to change anything.' },
    { part: 'Lower legs', prompt: 'Move up to your lower legs. Notice any tightness or heaviness, then let your attention rest there for a breath.' },
    { part: 'Hands', prompt: 'Now your hands. Fingers, palms, the weight of them in your lap or by your sides. Just notice.' },
    { part: 'Arms', prompt: 'Up through your arms to your shoulders. If you find tension, you do not have to fix it — noticing is the whole job.' },
    { part: 'Shoulders', prompt: 'Your shoulders carry a lot on a tense ride. Notice where they sit, and let them be exactly where they are.' },
    { part: 'Chest and belly', prompt: 'Notice your chest and belly moving as you breathe. No need to slow it down or speed it up. Let it do what it does.' },
    { part: 'Face and head', prompt: 'Your jaw, your forehead, the back of your head. Notice any clenching, and let your face soften only if it wants to.' },
    { part: 'Whole body', prompt: 'Now the whole body at once, feet to head, as one thing. Sit with that for a moment. You are here, and this ride is still moving.' }
  ];
  var scanIdx = 0;
  function scanRender(chime) {
    var s = SCAN[scanIdx];
    var t = $('scan42-title'); if (t) { t.textContent = s.part; }
    var p = $('scan42-prompt'); if (p) { p.textContent = s.prompt; }
    var c = $('scan42-count'); if (c) { c.textContent = (scanIdx + 1) + ' of ' + SCAN.length; }
    var back = $('scan42-back'); if (back) { back.style.visibility = scanIdx === 0 ? 'hidden' : 'visible'; }
    var next = $('scan42-next'); if (next) { next.textContent = scanIdx === SCAN.length - 1 ? 'Done' : 'Next'; }
    if (chime) { sound('tap', 'scan42-ind'); }
  }
  function scanGo(i) {
    scanIdx = i;
    if (scanIdx >= SCAN.length) { showScreen('screen-learn'); return; }
    scanRender(true);
  }

  /* ---------- wiring ---------- */
  function wire() {
    setPetNames();
    var rc = $('resume-wave-resume'); if (rc) { rc.addEventListener('click', resumeNow); }
    var dc = $('resume-wave-dismiss'); if (dc) { dc.addEventListener('click', dismissResume); }
    $all('[data-sen42]').forEach(function (b) {
      b.addEventListener('click', function () { senPick(b.getAttribute('data-sen42')); });
    });
    var sa = $('sen42-do-action'); if (sa) { sa.addEventListener('click', senAction); }
    var sf = $('sen42-do-finish'); if (sf) { sf.addEventListener('click', senAfter); }
    var sb = $('sen42-back-pick'); if (sb) { sb.addEventListener('click', function () { senClear(); senStage('sen42-pick'); }); }
    var sd = $('sen42-done-again'); if (sd) { sd.addEventListener('click', function () { senClear(); sen.ex = null; senStage('sen42-pick'); }); }
    var sk = $('scan42-back'); if (sk) { sk.addEventListener('click', function () { if (scanIdx > 0) { scanGo(scanIdx - 1); } }); }
    var nx = $('scan42-next'); if (nx) { nx.addEventListener('click', function () { scanGo(scanIdx + 1); }); }
    // Fallback navigation for the new screens only (the app's own
    // data-go handler runs first when app.js is loaded; this is a
    // no-op duplicate in that case, and the only path in tests).
    $all('[data-go="screen-sensation"], [data-go="screen-bodyscan"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-go');
        if (t === 'screen-sensation') { senClear(); sen.ex = null; senStage('sen42-pick'); }
        if (t === 'screen-bodyscan') { scanIdx = 0; scanRender(true); }
        showScreen(t);
      });
    });
    $all('#screen-sensation [data-go="screen-learn"], #screen-bodyscan [data-go="screen-learn"]').forEach(function (b) {
      b.addEventListener('click', function () { senClear(); showScreen('screen-learn'); });
    });
    // Leaving a calm42 exercise mid-timer must never leave a timer running.
    try {
      var clean = new MutationObserver(function () {
        var a = document.querySelector('.screen.active');
        if (a && a.id !== 'screen-sensation') { senClear(); }
      });
      $all('.screen').forEach(function (s) { clean.observe(s, { attributes: true, attributeFilter: ['class'] }); });
    } catch (e) {}
    maybeShowResume();
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', wire); }
  else { wire(); }

  window.__ihtCalm42 = {
    version: '42', key: KEY, hourMs: HOUR,
    readResume: readResume, record: record, clearResume: function () { remove(KEY); },
    maybeShowResume: maybeShowResume, resumeNow: resumeNow, dismissResume: dismissResume,
    scanSteps: SCAN, senExercises: SEN,
    _setHadAtLoad: function (v) { hadAtLoad = v; },
    _senState: function () { return sen; }, _scanIdx: function () { return scanIdx; }
  };
})();
