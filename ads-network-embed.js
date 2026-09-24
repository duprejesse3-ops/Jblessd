// MultiNiche Ads network embed. Drop this on any page:
//
//   <script src="https://multinicheai.com/ads-network-embed.js"
//           data-slot="slot_XXXXXXXXXX" data-container-id="mnads-slot_XXXXXXXXXX"></script>
//   <div id="mnads-slot_XXXXXXXXXX"></div>
//
// The slot key came from POST /api/ads/network/slots (see ads-network-slots.mts).
// No cookies, no third-party script, no bidding — one fetch to this store's
// own /api/ads/network/serve, which returns a single ad from another tenant
// in the network or nothing at all if none is eligible yet.
(function () {
  var scripts = document.querySelectorAll('script[data-slot]');
  var thisScript = scripts[scripts.length - 1];
  if (!thisScript) return;

  var slotKey = thisScript.getAttribute('data-slot');
  var containerId = thisScript.getAttribute('data-container-id') || 'mnads-' + slotKey;
  if (!slotKey) return;

  function render(container, ad) {
    if (!ad) {
      container.style.display = 'none';
      return;
    }
    container.innerHTML = '';
    var a = document.createElement('a');
    a.href = ad.clickUrl;
    a.target = '_blank';
    a.rel = 'noopener sponsored';
    a.style.cssText =
      'display:block;max-width:320px;border:1px solid #ddd;border-radius:8px;' +
      'padding:12px;text-decoration:none;color:inherit;font-family:sans-serif;';

    if (ad.imageUrl) {
      var img = document.createElement('img');
      img.src = ad.imageUrl;
      img.style.cssText = 'width:100%;border-radius:4px;margin-bottom:8px;display:block;';
      a.appendChild(img);
    }
    var h = document.createElement('div');
    h.textContent = ad.headline;
    h.style.cssText = 'font-weight:600;font-size:14px;margin-bottom:4px;';
    var b = document.createElement('div');
    b.textContent = ad.body;
    b.style.cssText = 'font-size:12.5px;color:#555;';
    var tag = document.createElement('div');
    tag.textContent = 'Ad · MultiNiche Ads network';
    tag.style.cssText = 'font-size:9.5px;color:#999;margin-top:8px;letter-spacing:0.03em;';

    a.appendChild(h);
    a.appendChild(b);
    a.appendChild(tag);
    container.appendChild(a);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var container = document.getElementById(containerId);
    if (!container) return;

    fetch('https://multinicheai.com/api/ads/network/serve?slotKey=' + encodeURIComponent(slotKey))
      .then(function (res) { return res.json(); })
      .then(function (data) { render(container, data.ad); })
      .catch(function () { container.style.display = 'none'; });
  });
})();
