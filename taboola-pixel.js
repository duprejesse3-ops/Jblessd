// Taboola pixel — page views plus the funnel and conversion events Taboola
// campaign reporting and optimization need.
//
// Shared by every public page (the storefront, the agent studio, the policy
// pages and the edge-generated SEO pages) so a Taboola audience sees the whole
// site rather than the homepage only. It is deliberately NOT loaded on
// /admin.html: that is the owner's private console, so its traffic would inflate
// audiences and conversion rates with visits that can never be a customer.
//
// Two things are separated here on purpose:
//
//   1. Recording an event — pushing onto window._tfa. This is inert: the array is
//      a queue the Taboola library drains when it loads, so a push on its own
//      sets no identifier and sends no request.
//   2. Loading the library — the point at which Taboola can actually store an
//      identifier and report.
//
// That split is what makes the consent gate below possible without losing
// events: the funnel is recorded from the first paint, and the queue either
// flushes when consent permits the library to load, or is discarded with the
// page if it never does.
(function () {
  // Taboola account 2081418.
  var ACCOUNT_ID = 2081418;

  window._tfa = window._tfa || [];

  // The GA4-style event names this site already emits (see the call sites of
  // window.trackMarketingEvent) mapped onto Taboola's standard conversion
  // events. Taboola can only optimize toward names it recognizes — an unmapped
  // name is accepted and then sits in reporting as a custom event no campaign
  // can bid on — so anything not named here is dropped unless the caller flagged
  // the action as a lead.
  var EVENT_NAMES = {
    view_item: 'view_content',
    add_to_cart: 'add_to_cart',
    begin_checkout: 'start_checkout',
    add_payment_info: 'add_payment_info',
    purchase: 'make_purchase',
    sign_up: 'subscribe',
    generate_lead: 'lead',
    search: 'search'
  };

  // Taboola's own vocabulary, accepted verbatim so a caller can name a Taboola
  // event directly instead of finding a GA4 name that happens to map to it.
  var TABOOLA_EVENTS = [
    'page_view', 'view_content', 'add_to_cart', 'start_checkout',
    'add_payment_info', 'make_purchase', 'lead', 'complete_registration',
    'subscribe', 'search', 'contact', 'start_trial'
  ];

  function taboolaName(name, options) {
    if (!name) return '';
    if (EVENT_NAMES[name]) return EVENT_NAMES[name];
    if (TABOOLA_EVENTS.indexOf(name) !== -1) return name;
    // demo_complete and the contact form are meaningful to Taboola even though
    // their GA4 names are the site's own: the shared lead flag says so.
    if (options && options.lead) return 'lead';
    return '';
  }

  // Records an event for Taboola. Takes the same (name, parameters, options)
  // shape as window.trackMarketingEvent so a call site can hand both tags the
  // identical arguments and neither has to know about the other's field names.
  window.trackTaboolaEvent = function (name, parameters, options) {
    var mapped = taboolaName(name, options);
    if (!mapped) return;
    var details = parameters || {};
    var event = { notify: 'event', name: mapped, id: ACCOUNT_ID };
    // Value-based bidding needs the order total, and Taboola reads it from
    // `revenue` — a GA4 `value` alone arrives as a conversion worth nothing.
    if (details.value !== undefined && details.value !== null && details.value !== '') {
      event.revenue = Number(details.value) || 0;
      event.currency = details.currency || 'USD';
    }
    // Lets Taboola discard a duplicate if a buyer reloads the confirmation page.
    if (details.transaction_id) event.orderid = String(details.transaction_id);
    window._tfa.push(event);
  };

  window._tfa.push({ notify: 'event', name: 'page_view', id: ACCOUNT_ID });

  // ---- consent gate ----
  //
  // The Google tags beside this one run under Consent Mode: gtag.js loads for
  // everybody and withholds storage until the visitor allows it, following the
  // regional defaults in privacy-consent.js. Taboola's library has no equivalent
  // switch — it stores its identifier as soon as it runs — so for this pixel the
  // load itself has to be the gate.
  //
  // Those regional defaults are mirrored rather than reinvented, so the pixel
  // behaves like the tags it sits next to: an explicit choice always wins, and a
  // visitor who has not chosen yet is treated as consent-required only if their
  // own browser places them in the European region list privacy-consent.js gates
  // on. Reading the browser's time zone keeps a geolocation round trip off the
  // critical path, and errs toward asking rather than assuming, because every
  // zone in those regions is Europe/* or Atlantic/*.
  function consentRequiredHere() {
    try {
      var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /^(Europe|Atlantic)\//.test(zone);
    } catch (_) {
      return true;
    }
  }

  function storedChoice() {
    return typeof window.getMarketingConsent === 'function'
      ? window.getMarketingConsent()
      : 'unknown';
  }

  var requested = false;
  function loadLibrary() {
    if (requested || document.getElementById('tb_tfa_script')) return;
    requested = true;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://cdn.taboola.com/libtrc/unip/' + ACCOUNT_ID + '/tfa.js';
    script.id = 'tb_tfa_script';
    // The CSP served by netlify/edge-functions/csp.ts admits scripts by nonce as
    // well as by host. cdn.taboola.com is allowlisted there, so this element is
    // permitted either way, but the nonce is copied across as well — the same
    // thing the Google Tag Manager snippet does — so the element still loads if
    // the host allowlist is ever tightened.
    var nonced = document.querySelector('[nonce]');
    if (nonced) script.setAttribute('nonce', nonced.nonce || nonced.getAttribute('nonce'));
    var first = document.getElementsByTagName('script')[0];
    if (first && first.parentNode) first.parentNode.insertBefore(script, first);
    else (document.head || document.documentElement).appendChild(script);
  }

  function evaluateConsent() {
    var choice = storedChoice();
    if (choice === 'denied') return;
    if (choice === 'granted' || !consentRequiredHere()) loadLibrary();
  }

  // privacy-consent.js announces the banner choice on this event, which is what
  // turns a European visitor's "Accept analytics" into a load on the same page
  // view instead of only on the next one.
  window.addEventListener('marketingconsentchange', evaluateConsent);
  evaluateConsent();
})();
