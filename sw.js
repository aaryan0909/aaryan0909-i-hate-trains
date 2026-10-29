/* I Hate Trains service worker — offline law: the core calming loop must work with zero network.
   Delivery fix (v18): network-first for navigations and core versioned assets so updates reach
   the phone; cache fallback keeps everything alive offline (tunnels, dead zones).
   v19: precaches drift.js (generative ambient music), trimap.js + ttc.json (TTC map module).
   NOTE: install does NOT skipWaiting — the app shows a calm "update ready" prompt on safe
   screens and only then asks the waiting worker to activate.
   v26: precaches stopheads.js (spoken stop heads-up module).
   v27: precaches guide.js (eyes-free guided rescue module).
   v29: panic-screen hero reorder + instant render — installed phones must re-cache.
   v30: home-screen "what has helped you" top-tools card — installed phones must re-cache.
   v34: precaches metros.js (line-level metro directory for London, NYC, Paris, Rome, Milan, Naples, Turin).
   v35: precaches v35-*.css, sound.js, stations.js, auth.js, metros.js updates; station JSONs are runtime-cached on first fetch (offline after first use).
   v38: guide rescue captions — installed phones must re-cache guide.js. */
var CACHE = 'iht-v39';
var ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'crisis.js',
  'stopheads.js',
  'guide.js',
  'drift.js',
  'trimap.js',
  'ttc.json',
  'metros.js',
  'stations.js',
  'sound.js',
  'auth.js',
  'v35-design.css',
  'v35-flow.css',
  'v35-pets.css',
  'v35-accounts.css',
  'v39-design.css',
  'manifest.webmanifest',
  'icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') { self.skipWaiting(); }
});

function isCoreAsset(url) {
  var name = url.pathname.split('/').pop();
  return ASSETS.indexOf(name) !== -1 || name === '' || ASSETS.indexOf('./' + name) !== -1;
}
function isNavigation(req) {
  if (req.mode === 'navigate') { return true; }
  var accept = req.headers.get('accept') || '';
  return req.method === 'GET' && accept.indexOf('text/html') !== -1;
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') { return; }
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) { return; } // third-party passes through untouched
  var networkFirst = isNavigation(e.request) || isCoreAsset(url);
  e.respondWith(
    networkFirst
      ? fetch(e.request).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          return res;
        }).catch(function () {
          return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
            return hit || caches.match('index.html');
          });
        })
      : caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
          return hit || fetch(e.request).then(function (res) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
            return res;
          }).catch(function () { return caches.match('index.html'); });
        })
  );
});
