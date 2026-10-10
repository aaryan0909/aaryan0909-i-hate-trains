/* I Hate Trains service worker — offline law: the core calming loop must work with zero network.
   Delivery fix (v18): network-first for navigations and core versioned assets so updates reach
   the phone; cache fallback keeps everything alive offline (tunnels, dead zones).
   NOTE: install does NOT skipWaiting — the app shows a calm "update ready" prompt on safe
   screens and only then asks the waiting worker to activate. */
var CACHE = 'iht-v18';
var ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
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
