/* MULTINICHE AI — service worker
   Offline support + install for the mobile app (PWA). */
// Bumped to v5 with the dedicated /order-confirmation route so the precached app
// shell (which embeds the tag markup and the purchase dataLayer push) is refetched
// instead of serving the old snippet to returning/offline visitors.
const CACHE = 'multiniche-ai-v5';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

// Pre-cache the app shell on install.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Drop old caches on activate.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache API / function calls — always go to the network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) {
    return;
  }

  // Navigations: network-first so shoppers get fresh catalog, fall back to
  // the cached shell when offline. Only the homepage response refreshes the
  // stored shell — other routes (the server-rendered product/proof pages, and
  // /order-confirmation, which carries one buyer's order in its query string)
  // must not become what an offline visitor sees when they open "/".
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (url.pathname === '/' || url.pathname === '/index.html') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Static assets: cache-first, then fill the cache on first fetch.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
