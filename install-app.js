/* MULTINICHE AI — install + offline wiring.
 *
 * Shared by the storefront, agent studio, and SWARM operator.
 *
 *   1. Register the service worker immediately (do not wait for window.load).
 *   2. Always show #install-app. Hidden-until-beforeinstallprompt meant the
 *      button never appeared in X, Grok, or a first Chrome visit.
 *   3. In Chrome/Edge: the tap calls the native install sheet in this window.
 *   4. In an in-app browser (X, Grok, Instagram): the tap hands the same URL
 *      to Chrome via an Android intent so install still happens without a
 *      scavenger hunt through menus.
 */
(function () {
  var LIVE = 'https://multinicheai.com/swarm?install=1';
  var FALLBACK_MS = 4000;
  var deferred = null;
  var btn = document.getElementById('install-app');
  var statusEl = document.getElementById('install-status');
  var steps = document.getElementById('android-steps');
  var installedNote = document.getElementById('installed-note');

  function standalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: window-controls-overlay)').matches
      || window.navigator.standalone === true;
  }

  function ua() { return navigator.userAgent || ''; }
  function isAndroid() { return /Android/i.test(ua()); }
  function isIOS() { return /iPad|iPhone|iPod/.test(ua()) && !window.MSStream; }
  function isEmbedded() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  function isPreviewHost() {
    return /grok-sandbox|grok\.com|localhost|127\.0\.0\.1/i.test(location.hostname);
  }
  function isIAB() {
    var s = ua();
    if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|Twitter|TikTok|Snapchat|LinkedInApp|Grok\/|; wv\)/i.test(s)) return true;
    if (/Android/i.test(s) && /\bwv\b/.test(s)) return true;
    if (isIOS() && /AppleWebKit/i.test(s) && !/Safari/i.test(s)) return true;
    return false;
  }

  function targetUrl() {
    if (isPreviewHost()) return LIVE;
    var u = new URL(location.href);
    u.searchParams.set('install', '1');
    return u.toString();
  }

  function chromeIntent(url) {
    var u = new URL(url);
    var path = u.host + u.pathname + u.search + u.hash;
    return 'intent://' + path + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(u.toString()) + ';end';
  }

  function setStatus(msg) {
    if (statusEl) {
      statusEl.hidden = !msg;
      statusEl.textContent = msg || '';
      return;
    }
    if (msg && typeof window.toast === 'function') window.toast(msg);
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.warn('Service worker registration failed:', err);
    });
  }

  function markInstalled() {
    deferred = null;
    if (btn) {
      btn.hidden = true;
      btn.disabled = false;
    }
    if (steps) steps.hidden = true;
    if (installedNote) installedNote.hidden = false;
    setStatus('');
  }

  function openChrome() {
    var url = targetUrl();
    setStatus('Opening Chrome to install…');
    if (isAndroid()) {
      window.location.href = chromeIntent(url);
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  registerSW();

  if (standalone()) {
    markInstalled();
    return;
  }

  if (btn) {
    btn.hidden = false;
    btn.disabled = false;
  }
  if (steps) steps.hidden = true;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (btn) {
      btn.hidden = false;
      btn.disabled = false;
    }
    if (new URLSearchParams(location.search).has('install')) {
      setStatus('Tap Download — Chrome will install in this window.');
    }
  });

  window.addEventListener('appinstalled', markInstalled);

  if (!btn) return;

  btn.addEventListener('click', function () {
    if (standalone()) { markInstalled(); return; }

    if (!deferred) {
      if (isIOS()) {
        setStatus('On iPhone: Share → Add to Home Screen.');
        if (steps) steps.hidden = false;
        return;
      }
      if (isAndroid() && (isIAB() || isEmbedded() || isPreviewHost())) {
        openChrome();
        return;
      }
      if (isEmbedded() || isPreviewHost()) {
        openChrome();
        return;
      }
      setStatus('Tap Download again. Chrome is preparing the install sheet.');
      if (steps) steps.hidden = false;
      return;
    }

    btn.disabled = true;
    var settled = false;
    var fallbackTimer = setTimeout(function () {
      if (settled) return;
      settled = true;
      btn.disabled = false;
      if (isAndroid()) {
        openChrome();
        return;
      }
      setStatus('Open Chrome menu (⋮) → Install app.');
      if (steps) steps.hidden = false;
    }, FALLBACK_MS);

    try {
      var promptResult = deferred.prompt();
      if (promptResult && typeof promptResult.catch === 'function') {
        promptResult.catch(function () {});
      }
    } catch (err) {
      console.warn('Install prompt failed:', err);
      clearTimeout(fallbackTimer);
      settled = true;
      btn.disabled = false;
      if (isAndroid()) openChrome();
      else {
        setStatus('Open Chrome menu (⋮) → Install app.');
        if (steps) steps.hidden = false;
      }
      return;
    }

    deferred.userChoice
      .catch(function () {})
      .then(function (choice) {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        var outcome = choice && choice.outcome;
        deferred = null;
        btn.disabled = false;
        if (outcome === 'accepted') {
          markInstalled();
          return;
        }
        btn.hidden = false;
        setStatus('Install cancelled. Tap Download to try again.');
      });
  });
})();
