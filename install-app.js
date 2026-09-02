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
 *
 * Some environments fire beforeinstallprompt but then never actually show the
 * native UI when prompt() is called — most commonly an in-app browser (the
 * embedded webview inside the X, Instagram, or Gmail app) that supports enough
 * of Chrome's API surface to trigger the event but cannot present the real
 * "Add to Home Screen" dialog. Without a timeout, tapping the button in that
 * situation does nothing and never recovers. FALLBACK_MS bounds how long we
 * wait for userChoice before assuming the prompt silently failed.
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
  var FALLBACK_MS = 4000;

  window.addEventListener('beforeinstallprompt', function (e) {
    // Suppress Chrome's mini-infobar; the button is the entry point instead, so
    // the invitation to install sits in the page's own chrome.
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });

  function showManualInstructions() {
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    var msg = isIOS
      ? 'Tap the Share icon, then "Add to Home Screen".'
      : 'Open this page in Chrome (not an app\'s built-in browser), then use the menu (⋮) → "Add to Home screen" or "Install app".';
    if (typeof window.toast === 'function') {
      window.toast(msg);
    } else {
      window.alert(msg);
    }
  }

  btn.addEventListener('click', function () {
    if (!deferred) { showManualInstructions(); return; }
    btn.disabled = true;

    var settled = false;
    var fallbackTimer = setTimeout(function () {
      if (settled) return;
      settled = true;
      // The native prompt never resolved — most likely an in-app browser that
      // can't present it. Reset the button and tell the person what to do by
      // hand instead of leaving it stuck disabled with no feedback.
      btn.disabled = false;
      showManualInstructions();
    }, FALLBACK_MS);

    try {
      var promptResult = deferred.prompt();
      // deferred.userChoice is a Promise per spec; some older/non-standard
      // implementations of the event don't return one from prompt() itself,
      // so we still rely on userChoice below rather than promptResult.
      if (promptResult && typeof promptResult.catch === 'function') {
        promptResult.catch(function () {});
      }
    } catch (err) {
      console.warn('Install prompt failed:', err);
      clearTimeout(fallbackTimer);
      settled = true;
      btn.disabled = false;
      showManualInstructions();
      return;
    }

    // A dismissal is a normal outcome, not an error: either way the saved event
    // is spent and cannot be prompted with again, so the button goes away.
    deferred.userChoice
      .catch(function () {})
      .then(function () {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
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
