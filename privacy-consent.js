(function () {
  var STORAGE_KEY = 'multiniche-consent-v1';
  var consentRegions = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','GB'];

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function consentState(granted) {
    return {
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
      analytics_storage: granted ? 'granted' : 'denied'
    };
  }

  // Same heuristic taboola-pixel.js / x-pixel.js already use: no geo round-trip.
  // The overlay used to paint for everybody on first load, so a US click from X
  // saw "Your privacy choices" before the proof. Consent Mode already applies
  // the denied default only to the region list below — the banner is what
  // didn't match.
  function consentRequiredHere() {
    try {
      var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /^(Europe|Atlantic)\//.test(zone);
    } catch (_) {
      return true;
    }
  }
  window.consentRequiredHere = consentRequiredHere;

  var saved = '';
  try { saved = localStorage.getItem(STORAGE_KEY) || ''; } catch (_) {}
  window.getMarketingConsent = function () {
    try { return localStorage.getItem(STORAGE_KEY) || 'unknown'; } catch (_) { return 'unknown'; }
  };
  if (saved === 'granted' || saved === 'denied') {
    window.gtag('consent', 'default', consentState(saved === 'granted'));
  } else {
    window.gtag('consent', 'default', Object.assign(consentState(false), {
      region: consentRegions,
      wait_for_update: 500
    }));
  }
  window.gtag('set', 'url_passthrough', true);
  window.gtag('set', 'ads_data_redaction', true);

  function save(choice) {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch (_) {}
    window.gtag('consent', 'update', consentState(choice === 'granted'));
    window.dataLayer.push({ event: 'consent_choice', consent_choice: choice });
    // Announce the choice to non-Google tags as well. Google's tags pick it up
    // from the consent update above, but a vendor without Consent Mode (the
    // Taboola pixel in taboola-pixel.js) can only react to a signal of its own,
    // and without one it would keep waiting until the next page view.
    try {
      window.dispatchEvent(new CustomEvent('marketingconsentchange', { detail: choice }));
    } catch (_) {}
    var banner = document.getElementById('privacy-consent');
    if (banner) banner.remove();
  }

  function fromClickThrough() {
    try {
      var q = String(location.search || '');
      if (/[?&](gclid|gbraid|wbraid|fbclid|ttclid|msclkid|twclid|li_fat_id|utm_source|utm_medium|utm_campaign)=/i.test(q)) {
        return true;
      }
      var ref = String(document.referrer || '');
      return /(^https?:\/\/([^/]+\.)?(t\.co|x\.com|twitter\.com|l\.facebook\.com|lm\.facebook\.com|m\.facebook\.com|instagram\.com|reddit\.com|outbrain\.com|taboola\.com))\//i.test(ref);
    } catch (_) {
      return false;
    }
  }

  function showBanner() {
    if (saved || document.getElementById('privacy-consent')) return;
    if (!consentRequiredHere()) return;
    var style = document.createElement('style');
    style.textContent = '#privacy-consent{position:fixed;z-index:40;left:12px;right:12px;bottom:12px;max-width:560px;margin:auto;padding:14px 16px;border:1px solid rgba(235,230,216,0.14);border-radius:10px;background:#12151cf2;color:#e8e4d8;box-shadow:0 12px 40px #0008;font:13px/1.45 system-ui,sans-serif}#privacy-consent strong{display:block;font:600 14px Georgia,serif;margin-bottom:4px;color:#f4f0e6}#privacy-consent p{margin:0 0 10px;color:#b7b3a8}#privacy-consent a{color:#c9c4b4}#privacy-consent .pc-actions{display:flex;gap:8px;flex-wrap:wrap}#privacy-consent button{border:1px solid rgba(235,230,216,0.22);border-radius:4px;padding:8px 12px;background:transparent;color:#e8e4d8;font:600 12px system-ui;cursor:pointer}#privacy-consent button[data-choice="granted"]{background:#e8e4d8;color:#0A0E16;border-color:#e8e4d8}';
    document.head.appendChild(style);
    var banner = document.createElement('aside');
    banner.id = 'privacy-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Privacy choices');
    banner.innerHTML = '<strong>Cookies</strong><p>Analytics and ads cookies, only if you want them. Otherwise the site still works. <a href="/privacy-policy/">Privacy policy</a>.</p><div class="pc-actions"><button type="button" data-choice="granted">Accept</button><button type="button" data-choice="denied">Essential only</button></div>';
    banner.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-choice]');
      if (button) save(button.getAttribute('data-choice'));
    });
    document.body.appendChild(banner);
  }

  // Never the first paint. Paid/social landings wait longer so the proof is
  // what a click sees, not a consent card sitting on the in-app browser chrome.
  function scheduleBanner() {
    if (saved || !consentRequiredHere()) return;
    var delay = fromClickThrough() ? 14000 : 8000;
    window.setTimeout(showBanner, delay);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleBanner);
  else scheduleBanner();
})();
