/* I Hate Trains station data loader (v35, flow workstream).
   Contract (another worker produces the files; this loader codes against it):
     stations/<cityId>.json =
       {"city":"London","updated":"2026-10-25","source":"<feed name + URL>",
        "lines":[{"id":"central","name":"Central line","color":"#E32037",
                  "stations":["West Ruislip", "..."]}] }
   City ids match metros.js keys (toronto, london, newyork, paris, rome,
   milan, naples, turin, ...). A missing file, a bad shape, or no network
   all mean the same thing: null, and the ride setup falls back to the
   manual stepper with honest labeling. Nothing here invents stations.
   Toronto is the exception with real data already in the repo: ttc.json
   (City of Toronto Open Data, GTFS static) is reshaped to the contract
   as stations/toronto.json, and ttc.json itself is kept as a fallback
   adapter so Toronto keeps working even if the reshaped file is absent.
   Pure helpers (stopsBetween, findLine, stationAt) live here so they can
   be unit-tested without a browser; app.js calls them for setup and trip. */
(function () {
  'use strict';
  var cache = {};
  var inflight = {};

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function normLine(l) {
    if (!isObj(l) || !Array.isArray(l.stations)) { return null; }
    var stations = l.stations.filter(function (s) { return typeof s === 'string' && s.trim(); });
    if (!stations.length) { return null; }
    return { id: String(l.id || l.name || ''), name: String(l.name || l.id || ''), color: l.color || '', stations: stations };
  }
  function norm(data) {
    if (!isObj(data) || !Array.isArray(data.lines)) { return null; }
    var lines = [];
    data.lines.forEach(function (l) { var n = normLine(l); if (n) { lines.push(n); } });
    if (!lines.length) { return null; }
    return { city: String(data.city || ''), updated: data.updated || '', source: data.source || '', lines: lines };
  }
  /* ttc.json shape: {lines:[{id,name,color,stops:[{n,lat,lon}]}]} */
  function fromTtc(data) {
    if (!isObj(data) || !Array.isArray(data.lines)) { return null; }
    return norm({
      city: data.name || 'Toronto', updated: data.generated || '',
      source: data.source || '',
      lines: data.lines.map(function (l) {
        return { id: l.id, name: l.name, color: l.color,
          stations: (l.stops || []).map(function (s) { return s.n; }) };
      })
    });
  }
  function fetchJson(url) {
    if (typeof fetch !== 'function') { return Promise.resolve(null); }
    return fetch(url).then(function (r) {
      if (!r || !r.ok) { return null; }
      return r.json();
    }).catch(function () { return null; });
  }
  function load(cityId) {
    if (!cityId) { return Promise.resolve(null); }
    if (cache[cityId]) { return Promise.resolve(cache[cityId]); }
    if (inflight[cityId]) { return inflight[cityId]; }
    inflight[cityId] = fetchJson('stations/' + cityId + '.json').then(function (d) {
      var n = norm(d);
      if (n) { cache[cityId] = n; return n; }
      /* Toronto fallback: the verified GTFS reshape in ttc.json. */
      if (cityId === 'toronto') {
        return fetchJson('ttc.json').then(function (t) {
          var a = fromTtc(t);
          if (a) { cache[cityId] = a; }
          return a;
        });
      }
      return null;
    }).then(function (v) { inflight[cityId] = null; return v; });
    return inflight[cityId];
  }
  /* Find a station line by metros.js line id first, then by display name
     (case-insensitive). Returns the line object or null. */
  function findLine(data, lineId, lineName) {
    if (!data || !data.lines) { return null; }
    var id = String(lineId || '').toLowerCase(), nm = String(lineName || '').toLowerCase();
    var i, l;
    if (id) { for (i = 0; i < data.lines.length; i++) { if (String(data.lines[i].id).toLowerCase() === id) { return data.lines[i]; } } }
    if (nm) { for (i = 0; i < data.lines.length; i++) { if (String(data.lines[i].name).toLowerCase() === nm) { return data.lines[i]; } } }
    return null;
  }
  /* Ordered distance between two stops on one line. Direction does not
     matter for the count: riding either way covers the same stops.
     Returns null when either stop is not on the list. */
  function stopsBetween(stations, from, dest) {
    if (!Array.isArray(stations)) { return null; }
    var a = stations.indexOf(from), b = stations.indexOf(dest);
    if (a < 0 || b < 0) { return null; }
    return Math.abs(b - a);
  }
  /* Station reached after `passed` stops from `fromIdx` toward `destIdx`.
     Returns null without station data. */
  function stationAt(stations, fromIdx, destIdx, passed) {
    if (!Array.isArray(stations) || fromIdx == null || destIdx == null) { return null; }
    var step = destIdx > fromIdx ? 1 : (destIdx < fromIdx ? -1 : 0);
    var idx = fromIdx + step * passed;
    if (idx < 0 || idx >= stations.length) { return null; }
    return stations[idx];
  }

  /* Freshness label for city screens. Pass loaded data (or a cityId whose
     data is already cached); returns null when there is nothing honest
     to show, so the screen can fall back to "station list unavailable". */
  function format(data) {
    if (!data) { return null; }
    var date = data.updated || 'unknown date';
    var src = data.source || 'unknown source';
    return 'Station data updated ' + date + ' · ' + src;
  }
  function freshness(cityIdOrData) {
    if (typeof cityIdOrData === 'string') {
      return format(cache[cityIdOrData] || null);
    }
    return format(cityIdOrData || null);
  }
  window.IHTStations = {
    load: load,
    get: function (cityId) { return cache[cityId] || null; },
    has: function (cityId) { return !!cache[cityId]; },
    findLine: findLine,
    stopsBetween: stopsBetween,
    stationAt: stationAt,
    format: format,
    freshness: freshness,
    /* test-only seam: normalize a raw payload without fetching. */
    _norm: norm,
    _fromTtc: fromTtc
  };
})();
