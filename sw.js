/* Focus Ledger service worker — precaches the whole app so it runs with no network. */
var VERSION = 'v1';
var CACHE = 'focus-ledger-' + VERSION;

var SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './fonts/codystar-400-latin.woff2',
  './fonts/codystar-400-latin-ext.woff2',
  './fonts/spacemono-400-latin.woff2',
  './fonts/spacemono-400-latin-ext.woff2',
  './fonts/spacemono-700-latin.woff2',
  './fonts/spacemono-700-latin-ext.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // addAll is all-or-nothing, so cache one by one and let a single miss slide
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // nothing off-origin is needed

  // Navigations: serve the cached page first so a cold, offline launch works.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(function (hit) {
        return hit || fetch(request).catch(function () { return caches.match('./'); });
      })
    );
    return;
  }

  // Everything else: cache first, then network, and keep what the network gives us.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (response && response.ok && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});
