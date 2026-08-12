/* MULTINICHE AI — install + offline wiring.
 *
 * Shared by the storefront (index.html) and the agent studio (agent.html) so both
 * are installable app windows in their own right. Two jobs:
 *
 *   1. Register the service worker. That is what turns the live site into
 *      something you open rather than something you visit: sw.js precaches both
 *      documents, so a launched window paints from cache and keeps working when
 *      the network is slow or gone.
 *   2. Reveal an "Install app" button — but only once the browser has confirmed
 *      the app is installable, so the control is never dead. A page opts in by
 *      including an element with id="install-app" and the `hidden` attribute.
 *
 * Loaded from a file rather than inlined on each page so the two cannot drift, and
 * because it is identical on every route and therefore worth caching once.
 *
 * Browsers with no install API (Safari, Firefox) simply never fire the event and
 * never show the button — installing there is the browser's own "Add to Home
 * Screen" / "Add to Dock" menu item, which needs nothing from the page. The
 * apple-mobile-web-app-* meta tags on both documents are what make that path
 * produce a standalone window instead of a bookmark.
 */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (err) {
        console.warn('Service worker registration failed:', err);
      });
    });
  }

  var btn = document.getElementById('install-app');
  if (!btn) return;

  var deferred = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    // Suppress Chrome's mini-infobar; the button is the entry point instead, so
    // the invitation to install sits in the page's own chrome.
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });

  btn.addEventListener('click', function () {
    if (!deferred) return;
    btn.disabled = true;
    deferred.prompt();
    // A dismissal is a normal outcome, not an error: either way the saved event
    // is spent and cannot be prompted with again, so the button goes away.
    deferred.userChoice
      .catch(function () {})
      .then(function () {
        deferred = null;
        btn.hidden = true;
        btn.disabled = false;
      });
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    btn.hidden = true;
  });
})();
