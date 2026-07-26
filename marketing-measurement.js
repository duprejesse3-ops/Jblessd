(function () {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  var ready = fetch('/api/analytics-config')
    .then(function (response) { return response.ok ? response.json() : {}; })
    .then(function (config) {
      if (config.ga4Id) window.gtag('config', config.ga4Id);
      if (config.adsId && config.adsId !== window.GOOGLE_ADS_TAG_ID) {
        window.gtag('config', config.adsId, { allow_enhanced_conversions: true });
      }
      return config;
    })
    .catch(function () { return {}; });

  window.marketingAnalyticsReady = ready;
  window.trackMarketingEvent = function (name, parameters, options) {
    var details = parameters || {};
    window.gtag('event', name, details);
    // Mirror the same funnel event to the Taboola pixel. Done here, at the one
    // hub every call site already goes through, so the two ad platforms cannot
    // drift apart: an event added to the funnel later reaches Taboola without
    // the call site knowing the pixel exists. taboola-pixel.js maps the GA4 name
    // onto Taboola's vocabulary and ignores anything Taboola has no use for.
    if (window.trackTaboolaEvent) window.trackTaboolaEvent(name, details, options);
    if (!options || !options.lead) return Promise.resolve();
    return ready.then(function (config) {
      if (!config.leadSendTo) return;
      window.gtag('event', 'conversion', {
        send_to: config.leadSendTo,
        value: Number(details.value || 0),
        currency: details.currency || 'USD'
      });
    });
  };
})();
