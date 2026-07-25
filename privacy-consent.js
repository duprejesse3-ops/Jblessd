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
    var banner = document.getElementById('privacy-consent');
    if (banner) banner.remove();
  }

  function showBanner() {
    if (saved || document.getElementById('privacy-consent')) return;
    var style = document.createElement('style');
    style.textContent = '#privacy-consent{position:fixed;z-index:10000;left:16px;right:16px;bottom:16px;max-width:720px;margin:auto;padding:18px;border:1px solid #7d2222;border-radius:8px;background:#110807f2;color:#ffd4d4;box-shadow:0 18px 60px #000b;font:14px/1.5 system-ui,sans-serif}#privacy-consent strong{display:block;font:600 17px Georgia,serif;margin-bottom:4px}#privacy-consent p{margin:0 0 12px;color:#e9a0a0}#privacy-consent a{color:#ff6a6a}#privacy-consent .pc-actions{display:flex;gap:9px;flex-wrap:wrap}#privacy-consent button{border:1px solid #ff2a2a;border-radius:4px;padding:9px 14px;background:transparent;color:#ffd4d4;font:600 13px system-ui;cursor:pointer}#privacy-consent button[data-choice="granted"]{background:#ff2a2a;color:#080000}';
    document.head.appendChild(style);
    var banner = document.createElement('aside');
    banner.id = 'privacy-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Privacy choices');
    banner.innerHTML = '<strong>Your privacy choices</strong><p>We use analytics and advertising cookies to measure what works and improve relevant offers. You can accept or continue with only essential storage. Read our <a href="/privacy-policy/">privacy policy</a>.</p><div class="pc-actions"><button type="button" data-choice="granted">Accept analytics</button><button type="button" data-choice="denied">Essential only</button></div>';
    banner.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-choice]');
      if (button) save(button.getAttribute('data-choice'));
    });
    document.body.appendChild(banner);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
  else showBanner();
})();
