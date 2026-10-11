/* TriMap — per-ride line chooser + live transit map for I Hate Trains.
 *
 * SCOPE: trip-setup surface only. This module never touches the panic,
 * breathing, grounding, or crisis flows. The core calming loop stays
 * offline-first and untouched.
 *
 * ONLINE ENHANCEMENT: the chooser and the map need internet (bundled
 * GTFS-derived data + GPS). When offline, or when GPS can't reach, this
 * module stays quiet and the existing manual stop-tap flow runs exactly
 * as before. GPS sleeps underground — the honest fallback ("tap each
 * stop as you feel it") is framed as the existing grounding ritual,
 * never as an error.
 *
 * Honest physical limit, stated in the UI: GPS does not work in tunnels.
 *
 * Zero dependencies. Vanilla JS, no build step. Phone-first, big touch
 * targets, prefers-reduced-motion respected.
 *
 * Line colours are PASTEL by design (Aaryan, 2026-10-10): official
 * transit reds/greens are too aggressive for an anxiety app. The hues
 * stay in the official family so lines remain recognizable.
 *
 * Public API (window.TriMap):
 *   loadCity(cityId)            -> Promise<cityData>
 *   findCityFor(text)           -> cityId | null
 *   matchLineId(cityData, text) -> lineId | null   ("Line 2" | "2" -> "2")
 *   stopsBetween(line, a, b)    -> number of stops from a to b
 *   mountChooser(el, opts)      -> renders the per-ride chooser into el
 *   openMap(el, opts)           -> renders the live map into el
 *   closeMap()                  -> stops GPS, clears map state
 *   current                     -> last chooser selection (or null)
 *   _                           -> internals exposed for tests
 */
(function () {
  'use strict';
  if (window.TriMap) { return; }

  /* ------------------------------------------------------------------ *
   * City registry. Adding a city = one JSON file + one entry here.
   * `match`: lowercase substrings matched against the city field.
   * ------------------------------------------------------------------ */
  var CITIES = {
    toronto: { file: 'ttc.json', match: ['toronto'] }
  };

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text != null) { e.textContent = text; }
    return e;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Haversine distance in metres. */
  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /* ------------------------------------------------------------------ *
   * Styles. Injected once, tm- prefixed, self-contained so trimap.js
   * ships as a single file with no styles.css edits.
   * ------------------------------------------------------------------ */
  var CSS = [
    '.tm-card{border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:18px;margin:14px 0;background:rgba(255,255,255,.03)}',
    '.tm-title{font-size:19px;margin:0 0 4px}',
    '.tm-sub{opacity:.72;font-size:14px;margin:0 0 12px}',
    '.tm-btn{display:block;width:100%;text-align:left;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:inherit;border-radius:16px;padding:16px;margin:10px 0;font-size:17px;cursor:pointer;min-height:56px}',
    '.tm-btn:active{transform:scale(.985)}',
    '.tm-btn .tm-dot{display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:10px;vertical-align:baseline}',
    '.tm-btn .tm-full{display:block;font-size:13px;opacity:.65;margin-top:2px}',
    '.tm-btn.primary{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.28)}',
    '.tm-row{display:flex;gap:10px}',
    '.tm-row .tm-btn{flex:1;text-align:center}',
    '.tm-back{background:none;border:none;color:inherit;opacity:.6;font-size:14px;padding:10px 0;cursor:pointer;min-height:44px}',
    '.tm-field{margin:12px 0}',
    '.tm-field label{display:block;font-size:14px;opacity:.75;margin-bottom:6px}',
    '.tm-field select{width:100%;font-size:17px;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:#1b1e26;color:inherit;min-height:56px}',
    '.tm-readout{text-align:center;font-size:16px;margin:12px 0;opacity:.9}',
    '.tm-check{display:flex;align-items:center;gap:12px;font-size:15px;margin:12px 0;min-height:48px;cursor:pointer}',
    '.tm-check input{width:26px;height:26px;accent-color:#9dc4a8}',
    '.tm-fine{font-size:13px;opacity:.6;margin:8px 0 0}',
    '.tm-status{text-align:center;font-size:14px;opacity:.8;min-height:22px;margin:8px 0}',
    '.tm-svg{width:100%;height:auto;display:block;border-radius:16px;background:rgba(255,255,255,.02);touch-action:pan-x pan-y}',
    '.tm-stop{cursor:pointer}',
    '.tm-stoplabel{font-size:11px;fill:#cfd2dc;paint-order:stroke;stroke:rgba(10,12,18,.85);stroke-width:3px}',
    '.tm-rider-halo{fill:rgba(255,255,255,.18)}',
    '.tm-rider{fill:#fff}',
    '.tm-bigbtn{display:block;width:100%;border-radius:18px;padding:18px;font-size:18px;margin:12px 0;min-height:64px;cursor:pointer;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.09);color:inherit}',
    '.tm-bigbtn:active{transform:scale(.98)}',
    '@media (prefers-reduced-motion: reduce){.tm-rider-halo{animation:none!important}.tm-svg *{transition:none!important}}',
    '.tm-rider-halo{animation:tm-pulse 2.4s ease-in-out infinite;transform-origin:center;transform-box:fill-box}',
    '@keyframes tm-pulse{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.6);opacity:.25}}'
  ].join('\n');

  var cssDone = false;
  function ensureCSS() {
    if (cssDone) { return; }
    cssDone = true;
    var s = document.createElement('style');
    s.setAttribute('data-tm', '1');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * Data layer
   * ------------------------------------------------------------------ */
  var cache = {};

  function loadCity(cityId) {
    if (!CITIES[cityId]) { return Promise.reject(new Error('unknown city')); }
    if (cache[cityId]) { return Promise.resolve(cache[cityId]); }
    return fetch(CITIES[cityId].file).then(function (r) {
      if (!r.ok) { throw new Error('data unavailable'); }
      return r.json();
    }).then(function (d) {
      cache[cityId] = d;
      return d;
    });
  }

  function findCityFor(text) {
    var t = String(text || '').toLowerCase();
    if (!t) { return null; }
    var ids = Object.keys(CITIES);
    for (var i = 0; i < ids.length; i++) {
      var m = CITIES[ids[i]].match;
      for (var j = 0; j < m.length; j++) {
        if (t.indexOf(m[j]) !== -1) { return ids[i]; }
      }
    }
    return null;
  }

  function lineById(data, id) {
    for (var i = 0; i < data.lines.length; i++) {
      if (data.lines[i].id === id) { return data.lines[i]; }
    }
    return null;
  }

  /* "Line 2", "line 2", "2" -> "2". Returns null when no line matches. */
  function matchLineId(data, text) {
    var t = String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    for (var i = 0; i < data.lines.length; i++) {
      var L = data.lines[i];
      var lid = String(L.id);
      var lname = L.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (t === lid || t === lname || t === ('line' + lid)) { return L.id; }
    }
    return null;
  }

  function stopsBetween(line, aIdx, bIdx) {
    return Math.abs(bIdx - aIdx);
  }

  /* Direction label for an origin->destination pair, from GTFS headsigns. */
  function directionLabel(line, aIdx, bIdx) {
    if (!line.directions || !line.directions.length) { return ''; }
    // directions[0] is the direction_id=0 headsign (canonical order).
    // If travelling with the canonical order, use it; else the other.
    return (bIdx > aIdx) ? line.directions[0]
      : (line.directions[1] || line.directions[0]);
  }

  /* ------------------------------------------------------------------ *
   * Chooser — per-ride line / origin / destination picker.
   *
   * mountChooser(el, opts):
   *   opts.cityEl   - the existing city <input> (read for Toronto match)
   *   opts.profile  - app profile object (reads profile.line as the
   *                   saved preferred line; never writes it)
   *   opts.onDone(selection) - selection: { cityId, lineId, lineName,
   *                   lineFull, color, originIdx, destIdx, origin, dest,
   *                   stopsToGo, towards, useMap }
   *
   * The chooser only fills in choices; the integrator copies them into
   * the existing setup fields. Silent when offline or when the data
   * can't load — the manual fields below always work.
   * ------------------------------------------------------------------ */
  function mountChooser(el, opts) {
    ensureCSS();
    opts = opts || {};
    el.innerHTML = '';
    if (!('onLine' in navigator) || !navigator.onLine) { return; }

    function cityNow() {
      var v = opts.cityEl && opts.cityEl.value;
      if (v) { return v; }
      return (opts.profile && opts.profile.city) || '';
    }

    function render() {
      el.innerHTML = '';
      var cityId = findCityFor(cityNow());
      if (!cityId) { return; } // not a mapped city: manual fields rule
      loadCity(cityId).then(function (data) {
        renderCard(el, data, opts);
      }).catch(function () {
        /* data failed: stay silent, manual flow untouched */
      });
    }

    render();
    if (opts.cityEl) {
      opts.cityEl.addEventListener('change', render);
    }
  }

  function renderCard(el, data, opts) {
    el.innerHTML = '';
    var card = h('div', 'tm-card');
    card.setAttribute('aria-label', 'Line picker');
    var prefId = matchLineId(data, opts.profile && opts.profile.line);

    card.appendChild(h('p', 'tm-title', 'Your line, or a fresh pick.'));
    card.appendChild(h('p', 'tm-sub',
      'Pick the line for this ride. The fields below always work too.'));

    if (prefId) {
      var L = lineById(data, prefId);
      var row = h('div', 'tm-row');
      var bMine = h('button', 'tm-btn primary',
        'Ride ' + L.name + ' — your usual.');
      bMine.setAttribute('type', 'button');
      bMine.addEventListener('click', function () {
        renderStopsStep(el, data, L, opts);
      });
      var bFresh = h('button', 'tm-btn', 'Choose each time.');
      bFresh.setAttribute('type', 'button');
      bFresh.addEventListener('click', function () {
        renderLineStep(el, data, opts);
      });
      row.appendChild(bMine);
      row.appendChild(bFresh);
      card.appendChild(row);
    } else {
      var b = h('button', 'tm-btn primary', 'Choose your line for this ride.');
      b.setAttribute('type', 'button');
      b.addEventListener('click', function () {
        renderLineStep(el, data, opts);
      });
      card.appendChild(b);
    }
    card.appendChild(h('p', 'tm-fine', 'Needs internet.'));
    el.appendChild(card);
  }

  function backBtn(el, fn) {
    var b = h('button', 'tm-back', '\u2190 back');
    b.setAttribute('type', 'button');
    b.addEventListener('click', fn);
    return b;
  }

  function renderLineStep(el, data, opts) {
    el.innerHTML = '';
    var card = h('div', 'tm-card');
    card.appendChild(h('p', 'tm-title', 'Which line today?'));
    data.lines.forEach(function (L) {
      var b = h('button', 'tm-btn');
      b.setAttribute('type', 'button');
      b.innerHTML = '<span class="tm-dot" style="background:' + esc(L.color) + '"></span>' +
        esc(L.name) + '<span class="tm-full">' + esc(L.full) + '</span>';
      b.addEventListener('click', function () {
        renderStopsStep(el, data, L, opts);
      });
      card.appendChild(b);
    });
    card.appendChild(backBtn(el, function () { renderCard(el, data, opts); }));
    el.appendChild(card);
  }

  function renderStopsStep(el, data, L, opts) {
    el.innerHTML = '';
    var card = h('div', 'tm-card');
    card.appendChild(h('p', 'tm-title', L.name + ' \u00b7 ' + L.full));

    function stopOptions(sel) {
      L.stops.forEach(function (s, i) {
        var o = document.createElement('option');
        o.value = String(i);
        o.textContent = s.n;
        sel.appendChild(o);
      });
    }

    var fFrom = h('div', 'tm-field');
    var labFrom = h('label', null, 'Where are you getting on?');
    var selFrom = h('select', null);
    selFrom.setAttribute('aria-label', 'Origin stop');
    stopOptions(selFrom);
    labFrom.appendChild(selFrom);
    fFrom.appendChild(labFrom);

    var fTo = h('div', 'tm-field');
    var labTo = h('label', null, 'Where are you getting off?');
    var selTo = h('select', null);
    selTo.setAttribute('aria-label', 'Destination stop');
    stopOptions(selTo);
    if (L.stops.length > 1) { selTo.selectedIndex = L.stops.length - 1; }
    labTo.appendChild(selTo);
    fTo.appendChild(labTo);

    var readout = h('p', 'tm-readout');
    function updateReadout() {
      var a = +selFrom.value, b = +selTo.value;
      if (a === b) {
        readout.textContent = 'Pick two different stops.';
      } else {
        readout.textContent = stopsBetween(L, a, b) + ' stops · ' +
          directionLabel(L, a, b);
      }
      useBtn.disabled = (a === b);
      useBtn.style.opacity = (a === b) ? '.45' : '1';
    }

    var checkWrap = h('label', 'tm-check');
    var check = h('input', null);
    check.setAttribute('type', 'checkbox');
    check.checked = true;
    checkWrap.appendChild(check);
    checkWrap.appendChild(h('span', null, 'Show the map while you ride'));
    var checkFine = h('p', 'tm-fine', 'Needs internet. GPS sleeps underground — the stop-tap ritual always works.');

    var useBtn = h('button', 'tm-btn primary', 'Use this ride.');
    useBtn.setAttribute('type', 'button');
    useBtn.addEventListener('click', function () {
      var a = +selFrom.value, b = +selTo.value;
      if (a === b) { return; }
      opts.onDone({
        cityId: 'toronto',
        lineId: L.id,
        line: L,
        lineName: L.name,
        lineFull: L.full,
        color: L.color,
        originIdx: a,
        destIdx: b,
        origin: L.stops[a].n,
        dest: L.stops[b].n,
        stopsToGo: stopsBetween(L, a, b),
        towards: directionLabel(L, a, b),
        useMap: check.checked && (('onLine' in navigator) ? navigator.onLine : true)
      });
    });

    selFrom.addEventListener('change', updateReadout);
    selTo.addEventListener('change', updateReadout);

    card.appendChild(fFrom);
    card.appendChild(fTo);
    card.appendChild(readout);
    card.appendChild(checkWrap);
    card.appendChild(checkFine);
    card.appendChild(useBtn);
    card.appendChild(backBtn(el, function () { renderLineStep(el, data, opts); }));
    el.appendChild(card);
    updateReadout();
  }

  /* ------------------------------------------------------------------ *
   * Map — geographically accurate SVG rendering of the GTFS shape +
   * stops, with live GPS rider tracking.
   *
   * Hand-rolled SVG, zero dependencies. Decision: no Leaflet, no raster
   * tiles. Rationale: (1) zero-dependency ethos is a hard product rule;
   * (2) no tile server, attribution, or CORS failure modes; (3) the
   * GTFS shape polyline IS the geographically accurate geometry —
   * equirectangular projection over a city-scale bbox has negligible
   * distortion; (4) schematic-calm styling matches the app instead of
   * fighting it with map visual noise; (5) SVG gives free hit-testing
   * for stop taps and crisp rendering at any density.
   *
   * openMap(el, opts):
   *   opts.line        - line object from city data
   *   opts.originIdx   - index of boarding stop
   *   opts.destIdx     - index of destination stop
   *   opts.stopsToGo   - initial shared counter value
   *   opts.getRemaining- optional fn() -> current shared counter
   *   opts.onAdvance() - called when a stop is reached (auto or manual);
   *                      the integrator wires this to the ONE shared
   *                      stop counter. Never a parallel counter.
   *   opts.onClose()   - called when the user leaves the map
   *
   * Map state machine (see TriMap._.mapStates for the transition table
   * used by tests):
   *   seeking -> live        (first GPS fix)
   *   seeking -> nogps        (timeout / unavailable — the underground case)
   *   seeking -> denied       (permission denied)
   *   live    -> nogps        (fixes stop arriving)
   *   any     -> offline      (window offline event)
   *   offline -> seeking      (window online event)
   * ------------------------------------------------------------------ */
  var ARRIVE_M = 150;      // auto-advance radius around the next stop
  var COOLDOWN_MS = 25000; // minimum gap between auto-advances

  var mapStates = {
    seeking: { fix: 'live', timeout: 'nogps', denied: 'denied', offline: 'offline' },
    live: { lost: 'nogps', denied: 'denied', offline: 'offline' },
    nogps: { fix: 'live', denied: 'denied', offline: 'offline' },
    denied: { offline: 'offline' },
    offline: { online: 'seeking' }
  };

  var M = null; // live map session, null when closed

  function makeProjector(line, w, h, pad) {
    var minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    function eat(lat, lon) {
      if (lat < minLat) { minLat = lat; }
      if (lat > maxLat) { maxLat = lat; }
      if (lon < minLon) { minLon = lon; }
      if (lon > maxLon) { maxLon = lon; }
    }
    line.stops.forEach(function (s) { eat(s.lat, s.lon); });
    (line.shape || []).forEach(function (p) { eat(p[0], p[1]); });
    var clat = (minLat + maxLat) / 2;
    var kx = Math.cos(clat * Math.PI / 180);
    var xR = Math.max((maxLon - minLon) * kx, 1e-9);
    var yR = Math.max(maxLat - minLat, 1e-9);
    var s = Math.min((w - pad * 2) / xR, (h - pad * 2) / yR);
    var ox = (w - pad * 2 - xR * s) / 2, oy = (h - pad * 2 - yR * s) / 2;
    return {
      x: function (lon) { return pad + ox + (lon - minLon) * kx * s; },
      y: function (lat) { return pad + oy + (maxLat - lat) * s; },
      bbox: { minLat: minLat, maxLat: maxLat, minLon: minLon, maxLon: maxLon }
    };
  }

  function transition(to, note) {
    if (!M) { return; }
    var from = M.gps;
    var allowed = mapStates[from] || {};
    var ok = false;
    for (var k in allowed) { if (allowed[k] === to) { ok = true; } }
    if (!ok && from !== to) { return; } // illegal transition: ignore
    M.gps = to;
    renderMapStatus(note);
  }

  function remainingNow() {
    if (!M) { return 0; }
    if (M.opts.getRemaining) {
      try { return M.opts.getRemaining(); } catch (e) { /* fall through */ }
    }
    return M.remaining;
  }

  function renderMapStatus(note) {
    if (!M || !M.statusEl) { return; }
    var t;
    var rem = remainingNow();
    if (note) { t = note; }
    else if (M.gps === 'seeking') { t = 'Finding you…'; }
    else if (M.gps === 'live') { t = 'Following you. ' + rem + (rem === 1 ? ' stop' : ' stops') + ' to go.'; }
    else if (M.gps === 'nogps') { t = 'GPS can\u2019t reach you down here — normal underground. Tap each stop as you feel it. Same ritual.'; }
    else if (M.gps === 'denied') { t = 'Location is off, so the map can\u2019t follow you. Tap each stop as you feel it — that always works.'; }
    else if (M.gps === 'offline') { t = 'You\u2019re offline — the map is pausing. Tap each stop as you feel it.'; }
    else { t = ''; }
    M.statusEl.textContent = t;
  }

  function drawMap() {
    var line = M.line, P = M.proj;
    var W = M.w, Hh = M.h;
    var pts = (line.shape || []).map(function (p) {
      return P.x(p[1]).toFixed(1) + ',' + P.y(p[0]).toFixed(1);
    }).join(' ');
    var svg = '<svg class="tm-svg" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Map of ' +
      esc(line.name) + ' with your position">';
    // soft underlay for contrast on the dark background
    svg += '<polyline points="' + pts + '" fill="none" stroke="' + esc(line.color) +
      '" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" opacity="0.18"/>';
    svg += '<polyline points="' + pts + '" fill="none" stroke="' + esc(line.color) +
      '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>';
    for (var i = 0; i < line.stops.length; i++) {
      (function (idx) {
        var s = line.stops[idx];
        var cx = P.x(s.lon).toFixed(1), cy = P.y(s.lat).toFixed(1);
        var cls = stopClass(idx);
        // generous invisible hit target (44px-ish) around a small visible dot
        svg += '<g class="tm-stop" data-i="' + idx + '">';
        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="22" fill="transparent"/>';
        svg += '<circle class="tm-svcdot ' + cls + '" cx="' + cx + '" cy="' + cy + '" r="' +
          (idx === M.nextIdx ? 8 : 6) + '" fill="' + (cls === 'done' ? 'none' : esc(line.color)) +
          '" stroke="' + esc(line.color) + '" stroke-width="2.5" opacity="' +
          (cls === 'done' ? '0.35' : cls === 'next' ? '1' : '0.75') + '"/>';
        if (idx === M.nextIdx) {
          svg += '<circle cx="' + cx + '" cy="' + cy + '" r="13" fill="none" stroke="' +
            esc(line.color) + '" stroke-width="1.5" opacity="0.6"/>';
        }
        if (idx === M.originIdx || idx === M.destIdx || idx === M.nextIdx) {
          var lx = (+cx + 10).toFixed(1), ly = (+cy - 10).toFixed(1);
          svg += '<text class="tm-stoplabel" x="' + lx + '" y="' + ly + '">' +
            esc(s.n) + '</text>';
        }
        svg += '</g>';
      })(i);
    }
    // rider dot (hidden until first fix)
    svg += '<g id="tm-rider" visibility="hidden">' +
      '<circle class="tm-rider-halo" r="14"/>' +
      '<circle class="tm-rider" r="6.5"/></g>';
    svg += '</svg>';
    M.svgHost.innerHTML = svg;
    var stops = M.svgHost.querySelectorAll('.tm-stop');
    for (var j = 0; j < stops.length; j++) {
      stops[j].addEventListener('click', function () {
        var idx = +this.getAttribute('data-i');
        onStopTap(idx);
      });
    }
  }

  function stopClass(idx) {
    var dir = M.dir;
    var behind = dir > 0 ? idx < M.nextIdx : idx > M.nextIdx;
    if (behind) { return 'done'; }
    if (idx === M.nextIdx) { return 'next'; }
    return 'todo';
  }

  function refreshStops() {
    // light re-render of stop visuals after each advance
    drawMap();
    if (M.lastPos) { placeRider(M.lastPos.lat, M.lastPos.lon); }
    renderMapStatus();
  }

  function placeRider(lat, lon) {
    var g = M.svgHost.querySelector('#tm-rider');
    if (!g) { return; }
    g.setAttribute('visibility', 'visible');
    var x = M.proj.x(lon), y = M.proj.y(lat);
    var cs = g.querySelectorAll('circle');
    for (var i = 0; i < cs.length; i++) {
      cs[i].setAttribute('cx', x.toFixed(1));
      cs[i].setAttribute('cy', y.toFixed(1));
    }
  }

  function onStopTap(idx) {
    if (!M) { return; }
    if (idx === M.nextIdx) {
      advance('manual');
    } else {
      // tapping any other stop just names it — no state change, no surprise
      var s = M.line.stops[idx];
      var rem = remainingNow();
      renderMapStatus(s.n + ' · ' +
        (rem === 1 ? '1 stop' : rem + ' stops') + ' to go.');
      setTimeout(function () { renderMapStatus(); }, 2600);
    }
  }

  function advance(kind) {
    if (!M || M.remaining <= 0) { return; }
    M.nextIdx += M.dir;
    M.remaining--;
    try { M.opts.onAdvance(kind); } catch (e) { /* integrator owns errors */ }
    if (!M) { return; } // onAdvance may have ended the trip (arrival -> closeMap)
    refreshStops();
  }

  function onPosition(pos) {
    if (!M) { return; }
    var lat = pos.coords.latitude, lon = pos.coords.longitude;
    M.lastPos = { lat: lat, lon: lon };
    placeRider(lat, lon);
    if (M.gps !== 'live') { transition('live'); } else { renderMapStatus(); }
    // auto-advance: only the single expected next stop, inside a calm
    // radius, with a cooldown so one stop never counts twice.
    if (M.nextIdx >= 0 && M.nextIdx < M.line.stops.length && M.remaining > 0) {
      var ns = M.line.stops[M.nextIdx];
      var d = haversine(lat, lon, ns.lat, ns.lon);
      var now = Date.now();
      if (d < ARRIVE_M && now - M.lastAuto > COOLDOWN_MS) {
        M.lastAuto = now;
        advance('auto');
      }
    }
  }

  function onPositionError(err) {
    if (!M) { return; }
    var code = err && err.code;
    if (code === 1) { transition('denied'); }
    else { transition('nogps'); } // timeout / unavailable: the underground case
  }

  function startWatch() {
    stopWatch();
    if (!('geolocation' in navigator)) {
      transition('nogps');
      return;
    }
    try {
      M.watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
        enableHighAccuracy: false, // battery-sane; underground kills GPS anyway
        timeout: 30000,
        maximumAge: 15000
      });
    } catch (e) {
      transition('nogps');
    }
    // if no fix arrives, say the honest thing (the underground case)
    clearTimeout(M.seekTimer);
    M.seekTimer = setTimeout(function () {
      if (M && M.gps === 'seeking') { transition('nogps'); }
    }, 12000);
  }

  function stopWatch() {
    if (M && M.watchId != null) {
      try { navigator.geolocation.clearWatch(M.watchId); } catch (e) {}
      M.watchId = null;
    }
    if (M) { clearTimeout(M.seekTimer); }
  }

  function openMap(el, opts) {
    ensureCSS();
    closeMap();
    el.innerHTML = '';

    var line = opts.line;
    var dir = opts.destIdx > opts.originIdx ? 1 : -1;
    var originName = opts.originName || line.stops[opts.originIdx].n;
    var destName = opts.destName || line.stops[opts.destIdx].n;

    var head = h('div', null);
    head.appendChild(h('p', 'tm-title', line.name + ' · ' + line.full));
    var sub = h('p', 'tm-sub', originName + ' → ' + destName);
    head.appendChild(sub);
    el.appendChild(head);

    var svgHost = h('div', null);
    el.appendChild(svgHost);

    var statusEl = h('p', 'tm-status');
    statusEl.setAttribute('aria-live', 'polite');
    el.appendChild(statusEl);

    var tapBtn = h('button', 'tm-bigbtn', 'Felt a stop — tap.');
    tapBtn.setAttribute('type', 'button');
    el.appendChild(tapBtn);

    var backBtn = h('button', 'tm-back', '\u2190 back to ride');
    backBtn.setAttribute('type', 'button');
    el.appendChild(backBtn);

    // map geometry: fit the line bbox, phone-first
    var w = 640, aspectPad = 48;
    var probe = makeProjector(line, w, 400, aspectPad);
    var bb = probe.bbox;
    var kx = Math.cos(((bb.minLat + bb.maxLat) / 2) * Math.PI / 180);
    var xR = (bb.maxLon - bb.minLon) * kx, yR = (bb.maxLat - bb.minLat);
    var Hh = Math.round(w * (yR / Math.max(xR, 1e-9)));
    Hh = Math.max(280, Math.min(560, Hh));

    M = {
      line: line,
      originIdx: opts.originIdx,
      destIdx: opts.destIdx,
      dir: dir,
      nextIdx: opts.originIdx + dir,
      remaining: opts.stopsToGo,
      opts: opts,
      svgHost: svgHost,
      statusEl: statusEl,
      w: w,
      h: Hh,
      proj: makeProjector(line, w, Hh, aspectPad),
      gps: 'seeking',
      watchId: null,
      seekTimer: null,
      lastAuto: 0,
      lastPos: null
    };

    tapBtn.addEventListener('click', function () { advance('manual'); });
    backBtn.addEventListener('click', function () {
      var cb = M && M.opts.onClose;
      if (cb) { try { cb(); } catch (e) {} }
    });

    function onOffline() { if (M) { transition('offline'); } }
    function onOnline() {
      if (M && M.gps === 'offline') {
        transition('seeking');
        startWatch();
      }
    }
    M.onOffline = onOffline;
    M.onOnline = onOnline;
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    drawMap();
    renderMapStatus();
    if (!navigator.onLine) {
      transition('offline');
    } else {
      startWatch();
    }
  }

  function closeMap() {
    if (!M) { return; }
    stopWatch();
    window.removeEventListener('offline', M.onOffline);
    window.removeEventListener('online', M.onOnline);
    M = null;
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */
  window.TriMap = {
    CITIES: CITIES,
    current: null, // last chooser selection; the integrator reads it at trip start
    loadCity: loadCity,
    findCityFor: findCityFor,
    matchLineId: matchLineId,
    stopsBetween: stopsBetween,
    directionLabel: directionLabel,
    mountChooser: mountChooser,
    openMap: openMap,
    closeMap: closeMap,
    /* test hooks — not for production use */
    _: {
      haversine: haversine,
      makeProjector: makeProjector,
      mapStates: mapStates,
      ARRIVE_M: ARRIVE_M,
      COOLDOWN_MS: COOLDOWN_MS,
      getSession: function () { return M; },
      // drive the state machine without a real GPS (tests stub geolocation)
      _transition: function (to) { transition(to); },
      _onPosition: function (lat, lon) {
        onPosition({ coords: { latitude: lat, longitude: lon } });
      },
      _onPositionError: function (code) { onPositionError({ code: code }); },
      _advance: function (kind) { advance(kind || 'manual'); }
    }
  };
})();
