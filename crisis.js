/* I Hate Trains — locale-aware crisis line (v24).
   988 is US/Canada only; everywhere else the panic screen shows the real number
   for where the phone is, or the Find A Helpline directory.
   Every number below was verified 2026-10-14 from an official source (org site,
   health ministry, or government press release). Never invent one: unknown
   locales fall back to the directory link, not a guess.
   Loads before app.js; exposes window.__ihtCrisis. No dependencies, no network. */
(function () {
  'use strict';

  var CRISIS_LINES = [
    { cc: ['us', 'ca'], display: '988', dial: '988', verb: 'call or text', label: 'Suicide & Crisis Lifeline', sub: 'US & Canada' },
    { cc: ['gb', 'ie'], display: '116 123', dial: '116123', verb: 'call', label: 'Samaritans', sub: 'UK & Ireland' },
    { cc: ['it'], display: '02 2327 2327', dial: '+390223272327', verb: 'call', label: 'Telefono Amico Italia', sub: 'Italy' },
    { cc: ['fr'], display: '3114', dial: '3114', verb: 'call', label: 'National suicide prevention', sub: 'France' },
    { cc: ['de'], display: '0800 111 0 111', dial: '08001110111', verb: 'call', label: 'Telefonseelsorge', sub: 'Germany' },
    { cc: ['es'], display: '024', dial: '024', verb: 'call', label: 'Línea 024', sub: 'Spain' },
    { cc: ['au'], display: '13 11 14', dial: '131114', verb: 'call', label: 'Lifeline', sub: 'Australia' },
    { cc: ['nl'], display: '113', dial: '113', verb: 'call', label: '113 Zelfmoordpreventie', sub: 'Netherlands' },
    { cc: ['in'], display: '1800-599-0019', dial: '18005990019', verb: 'call', label: 'Kiran helpline', sub: 'India' }
  ];

  /* region from the phone's locale, e.g. it-IT -> 'it', en-CA -> 'ca', 'it' -> 'it'.
     Bare 'en' (or anything unparseable) keeps the old default, 'us'. */
  function crisisRegion() {
    var lang = '';
    try { lang = String(navigator.language || navigator.userLanguage || '').toLowerCase(); } catch (e) {}
    var m = lang.replace(/_/g, '-').match(/^([a-z]{2,3})(?:-([a-z]{2}|\d{3}))?$/);
    if (m && m[2] && m[2].length === 2) { return m[2]; }
    if (m && m[1] && m[1].length === 2 && m[1] !== 'en') { return m[1]; }
    return 'us';
  }

  function crisisLineForRegion(r) {
    for (var i = 0; i < CRISIS_LINES.length; i++) {
      if (CRISIS_LINES[i].cc.indexOf(r) !== -1) { return CRISIS_LINES[i]; }
    }
    return null;
  }

  function telHref(dial) { return 'tel:' + String(dial).replace(/[^+\d]/g, ''); }

  function byId(id) { return document.getElementById(id); }

  /* panic screen: one quiet line, the real number for where the phone is.
     v31: no prefix sentence — the panic screen has a 20-word budget and the
     number itself is the message. */
  function renderQuietCrisis() {
    var el = byId('crisis-quiet');
    if (!el) { return; }
    var line = crisisLineForRegion(crisisRegion());
    while (el.firstChild) { el.removeChild(el.firstChild); }
    var a = document.createElement('a');
    if (line) {
      a.href = telHref(line.dial);
      a.textContent = line.verb + ' ' + line.display;
    } else {
      a.href = 'https://findahelpline.com';
      a.textContent = 'find help where you are';
    }
    el.appendChild(a);
  }

  /* crisis screen: a first row for the locale line, unless it is one of the two
     rows that are always listed (988, 116 123) — no duplicates. */
  function renderLocaleCrisis() {
    var row = byId('crisis-locale');
    if (!row) { return; }
    var line = crisisLineForRegion(crisisRegion());
    if (line && line.dial !== '988' && line.dial !== '116123') {
      row.hidden = false;
      row.href = telHref(line.dial);
      byId('crisis-locale-label').textContent = 'Call ' + line.display;
      byId('crisis-locale-sub').textContent = line.sub + ' · ' + line.label;
    } else {
      row.hidden = true;
    }
  }

  window.__ihtCrisis = {
    region: crisisRegion,
    lineFor: crisisLineForRegion,
    renderQuiet: renderQuietCrisis,
    renderLocale: renderLocaleCrisis
  };
})();
