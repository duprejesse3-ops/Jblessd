// X (Twitter) Ads pixel — base website tag + funnel event mirroring.
//
// Mirrors taboola-pixel.js's structure deliberately: same consent gate, same
// "record now, load-and-flush later" split, same trackXxxEvent(name, params,
// options) signature so a call site never needs to know how many ad platforms
// are listening. See taboola-pixel.js for the fuller rationale comment; this
// file only documents what's different about X specifically.
//
// PIXEL_ID 'rf01m' is this account's Universal Website Tag id, from X Ads
// Manager -> Events Manager -> X Pixel -> base code. Calling twq('config',
// PIXEL_ID) on every page is what activates the two auto-created events
// (Landing page views, Site visits) — no separate event id is needed for
// those two, they come from the base tag alone.
//
// PURCHASE (and any other custom conversion) is NOT wired yet. X ties a
// specific paid action to a per-event id (shaped like 'tw-rf01m-xxxxx') that
// Events Manager only hands out once a dedicated conversion event exists
// there beyond the two auto-created ones. EVENT_IDS below is where that id
// goes once it exists — until then, trackXEvent() for an unmapped name is a
// deliberate, logged no-op rather than a guess at an id that would silently
// send nothing (or worse, send to the wrong event).
(function () {
  var PIXEL_ID = 'rf01m';

  // Fill in as real conversion events get created in X Ads Manager. Left
  // empty on purpose — see file header. Example once you have one:
  //   purchase: 'tw-rf01m-abcde'
  var EVENT_IDS = {
    // purchase: '',
    // sign_up: '',
    // generate_lead: '',
  };

  !(function (e, t, n, s, u, a) {
    e.twq ||
      ((s = e.twq =
        function () {
          s.exe ? s.exe.apply(s, arguments) : s.queue.push(arguments);
        }),
      (s.version = '1.1'),
      (s.queue = []),
      (u = t.createElement(n)),
      (u.async = !0),
      (u.src = 'https://static.ads-twitter.com/uwt.js'),
      (a = t.getElementsByTagName(n)[0]),
      a.parentNode.insertBefore(u, a));
  })(window, document, 'script');

  // The CSP served by netlify/edge-functions/csp.ts admits scripts by nonce as
  // well as by host (see GOOGLE_SCRIPT_HOSTS' comment in that file for why both
  // are needed) — uwt.js is inserted by the snippet above before this script
  // runs again, so nonce it the same way taboola-pixel.js noncing its own
  // injected script, on the next tick once the element exists.
  function nonceInjectedScript() {
    var injected = document.querySelector('script[src="https://static.ads-twitter.com/uwt.js"]');
    if (!injected || injected.nonce) return;
    var nonced = document.querySelector('[nonce]');
    if (nonced) injected.setAttribute('nonce', nonced.nonce || nonced.getAttribute('nonce'));
  }

  // Records a funnel event for X. Same (name, parameters, options) shape as
  // window.trackMarketingEvent, so marketing-measurement.js can hand this the
  // exact same arguments it already builds for GA4/Taboola.
  window.trackXEvent = function (name, parameters, options) {
    var eventId = EVENT_IDS[name];
    if (!eventId) return; // unmapped — see EVENT_IDS comment; not an error, just not wired yet
    var details = parameters || {};
    var payload = {};
    if (details.value !== undefined && details.value !== null && details.value !== '') {
      payload.value = Number(details.value) || 0;
      payload.currency = details.currency || 'USD';
    }
    if (details.transaction_id) payload.conversion_id = String(details.transaction_id);
    window.twq('event', eventId, payload);
  };

  // ---- consent gate ----
  //
  // X's pixel has no Consent Mode equivalent (same situation as Taboola), so
  // — exactly as in taboola-pixel.js — the config call itself is the gate.
  // The regional check and stored-choice reader are duplicated rather than
  // imported (this file has to stand alone as a plain <script src>, same as
  // its sibling), but the logic is identical on purpose: a visitor sees one
  // consistent consent decision across every ad platform on the site, not a
  // different one per pixel.
  function consentRequiredHere() {
    try {
      var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /^(Europe|Atlantic)\//.test(zone);
    } catch (_) {
      return true;
    }
  }

  function storedChoice() {
    return typeof window.getMarketingConsent === 'function' ? window.getMarketingConsent() : 'unknown';
  }

  var configured = false;
  function loadPixel() {
    if (configured) return;
    configured = true;
    window.twq('config', PIXEL_ID);
    // uwt.js inserts its own <script> element synchronously inside the twq
    // stub above, so it already exists by the time config() returns.
    nonceInjectedScript();
  }

  function evaluateConsent() {
    var choice = storedChoice();
    if (choice === 'denied') return;
    if (choice === 'granted' || !consentRequiredHere()) loadPixel();
  }

  // privacy-consent.js announces the banner choice on this event — see
  // taboola-pixel.js for why this is what turns an EU visitor's "Accept
  // analytics" click into a load on the same page view.
  window.addEventListener('marketingconsentchange', evaluateConsent);
  evaluateConsent();
})();
