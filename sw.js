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
// Bumped to v9 for the jblessd.com -> multinicheai.com domain migration: forces
// every existing install (PWA and any lingering TWA) to drop its old cache and
// refetch the app shell and icons rather than continuing to serve pre-migration
// copies.
// Bumped to v10 so the installed SWARM operator at /swarm is in the app shell
// and Chrome on Android can offer "Install app" / Add to Home screen.
// Bumped to v11 so returning installs drop the old privacy-consent.js that
// painted the cookie card on first load for every visitor, including US
// click-throughs from X.
// Bumped to v12 so the installed SWARM composer stops opening r/smallbusiness
// feed posts (those get removed as AI promo and can ban the account).
// Bumped to v13 so returning installs pick up the always-visible Download
// button that installs in Chrome in-app (or hands X/Grok to Chrome).
// Bumped to v14 so returning installs pick up the first-party Multiniche Ads
// tag on the storefront (mn-ads.js + the catalog slot).
// Bumped to v15 so the MultiNicheADS icon on the store opens /ads.
// Bumped to v16: /order-confirmation no longer falls back to the cached
// homepage on a failed fetch — see the comment in the fetch handler. This
// was silently dropping buyers on what looked like an ordinary homepage
// after a real, successful payment, with no order and no download link.
const CACHE = 'multiniche-ai-v16';
const APP_SHELL = [
  '/',
  '/index.html',
  '/agent',
  '/ads',
  '/ads.html',
  '/swarm',
  '/swarm.html',
  '/privacy-consent.js',
  '/marketing-measurement.js',
  '/install-app.js',
  '/mn-ads.js',
  '/manifest.webmanifest',
  '/swarm-manifest.webmanifest',
  '/icons/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/swarm/icon-192.png',
  '/icons/swarm/icon-512.png'
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
    const isSwarm = url.pathname === '/swarm' || url.pathname === '/swarm.html';
    // /order-confirmation carries one buyer's session_id in its URL and is the
    // ONLY proof they see that a real purchase went through, plus where their
    // download link lives. It used to fall into the generic "any other route"
    // branch below, whose catch() substitutes the cached HOMEPAGE on any
    // failed fetch — and switching back to the browser/PWA right after Stripe
    // redirects is exactly when a transient mobile network blip is likely.
    // The buyer lands on what looks like an ordinary homepage: no error, no
    // order, no download link, and nothing telling them anything went wrong —
    // indistinguishable from "checkout silently failed," even when the
    // payment genuinely succeeded. A short retry absorbs the transient blip;
    // failing that, this deliberately does NOT substitute a different cached
    // page. An honest browser offline/error screen at least invites a
    // reload, and /api/order re-verifies with Stripe on every call, so a
    // reload alone recovers the order — a silently-wrong homepage doesn't
    // even suggest reloading is worth trying.
    const fetchWithRetry = () => fetch(req).catch(() => fetch(req));
    if (url.pathname === '/order-confirmation') {
      event.respondWith(fetchWithRetry());
      return;
    }
    event.respondWith(
      fetchWithRetry()
        .then((res) => {
          if (isHome || isAgent || isSwarm) {
            const copy = res.clone();
            const key = isSwarm ? '/swarm' : isAgent ? '/agent' : '/';
            caches.open(CACHE).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(() => {
          const shell = isSwarm ? ['/swarm', '/swarm.html'] : isAgent ? ['/agent', '/'] : ['/', '/index.html'];
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
