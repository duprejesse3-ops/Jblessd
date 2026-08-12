/* MULTINICHE AI — service worker
   Offline support + install for the mobile app (PWA). */
// Bumped to v5 with the dedicated /order-confirmation route so the precached app
// shell (which embeds the tag markup and the purchase dataLayer push) is refetched
// instead of serving the old snippet to returning/offline visitors.
// Bumped to v6 to drop any shell stored by an earlier build: a Tag Assistant /
// GTM Preview navigation used to be cached as "/", so a visitor (or a later
// debugging run) could be served a page pinned to a finished debug session. The
// fetch handler below now stays out of the way for those URLs entirely.
// Bumped to v8 so the installed app carries the agent studio with it: /agent is
// the surface the owner and customers actually work on, and until now it was not
// in the shell, so an installed app opened to a browser error page whenever the
// network was slow or absent. It gets its own cache entry rather than sharing the
// storefront's, because the two are different documents and either one may be the
// window that was launched.
const CACHE = 'multiniche-ai-v8';
const APP_SHELL = [
  '/',
  '/index.html',
  '/agent',
  '/privacy-consent.js',
  '/marketing-measurement.js',
  '/install-app.js',
  '/manifest.webmanifest',
  '/icons/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

// Pre-cache the app shell on install.
//
// Each entry is added on its own instead of with a single cache.addAll, which
// rejects as a unit: one asset 404ing or one flaky response used to fail the whole
// install, leaving a visitor with no offline shell at all rather than a shell
// missing one icon. The two documents are what matter, so a failure on either is
// still worth surfacing in the console.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(APP_SHELL.map((url) =>
        cache.add(url).catch((err) => {
          console.warn('Service worker could not precache', url, err);
        })
      )))
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

// Tag Assistant / GTM Preview load the site with these parameters on the URL, and
// the container reads them to open its debug connection. Such a navigation must
// never become the stored app shell: the shell is what an offline or returning
// visitor is served for "/", and a page pinned to one debug session is both wrong
// for them and a way for a stale snapshot to be handed back to a later debugging
// run instead of the live page.
const DEBUG_PARAMS = ['gtm_debug', 'gtm_preview', 'gtm_auth'];

function isTagDebug(url) {
  return DEBUG_PARAMS.some((p) => url.searchParams.has(p));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache API / function calls — always go to the network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) {
    return;
  }

  // The private admin workstation is served no-store and shows one owner's live
  // operational data. Stay out of it entirely: nothing to cache, and an offline
  // navigation there must not be answered with the storefront shell, which would
  // read as "the console loaded and your store is empty".
  if (url.pathname === '/admin' || url.pathname === '/admin.html') {
    return;
  }

  // The code workspace and the apps it serves are the one part of the site whose
  // whole point is that a save is live on the very next load. Caching either
  // would defeat that in the most confusing way possible — an edit that saved
  // successfully, on a URL that keeps showing the previous version — so both are
  // passed through to the network untouched.
  //
  // The asset branch at the bottom of this file is the specific hazard: without
  // this, an app's style.css or app.js would be stored on first fetch and served
  // from cache forever after, so the page would update while its stylesheet and
  // script silently would not.
  //
  // No cache version bump accompanies this: /code and /p/ are new routes, so no
  // installed copy of this worker can be holding a stale entry for them.
  if (url.pathname === '/code' || url.pathname === '/code.html' ||
      url.pathname === '/p' || url.pathname.startsWith('/p/')) {
    return;
  }

  // A tag debugging session must always see the live page, headers and all —
  // including the fresh per-request CSP nonce from netlify/edge-functions/csp.ts.
  // Stay out of the way entirely rather than answering from, or writing to, cache.
  if (isTagDebug(url)) {
    return;
  }

  // Navigations: network-first so shoppers get fresh catalog, fall back to a
  // cached shell when offline.
  //
  // Only the two installable documents refresh their own stored copy — the
  // homepage and the agent studio. Every other route (the server-rendered
  // product/proof pages, and /order-confirmation, which carries one buyer's order
  // in its query string) must not become what an offline visitor is handed, so
  // they are served from the network and fall back to the nearest shell.
  //
  // The fallback is chosen by where the visitor was going, not by a single global
  // shell: an installed app launched at /agent that fell back to the storefront
  // looked like the app had lost the studio.
  if (req.mode === 'navigate') {
    const isHome = url.pathname === '/' || url.pathname === '/index.html';
    const isAgent = url.pathname === '/agent' || url.pathname === '/agent.html';
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isHome || isAgent) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(isAgent ? '/agent' : '/', copy));
          }
          return res;
        })
        .catch(() => {
          const shell = isAgent ? ['/agent', '/'] : ['/', '/index.html'];
          return caches.match(shell[0]).then((r) => r || caches.match(shell[1]));
        })
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
