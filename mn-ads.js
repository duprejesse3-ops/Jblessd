// Multiniche Ads — first-party tag for multinicheai.com.
//
//   <div data-mn-ad data-site="multinicheai.com" data-slot="s_store_home"
//        data-format="display" data-tags="founders,prompts"></div>
//   <script src="/mn-ads.js" defer></script>
//
// Same-origin on purpose. This store's CSP nonces every <script> and connect-src
// is 'self' plus the measurement hosts — a third-party Grok/Vercel tag.js would
// be blocked. The browser talks only to /api/ads/{serve,run,click,offer} on this
// host. Those functions proxy to MN_ADS_ORIGIN (the published exchange) when that
// env is set, otherwise they house-fill from the live catalog so the unit is
// never an empty box.
//
// Billable event on a filled spec: the visitor taps "Run it on this page" and the
// article/product is the task. Keep this spec copies the instrument.
(() => {
  var ORIGIN = location.origin;

  function qs(el) {
    var p = new URLSearchParams();
    p.set("site", el.getAttribute("data-site") || location.hostname);
    p.set("slot", el.getAttribute("data-slot") || "s_store_home");
    p.set("format", el.getAttribute("data-format") || "display");
    p.set("pageview", "pv_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36));
    p.set("url", location.href);
    var tags = el.getAttribute("data-tags");
    if (tags) p.set("tags", tags);
    var q = el.getAttribute("data-q") || (new URLSearchParams(location.search).get("q") || "");
    if (q) p.set("q", q);
    return p.toString();
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"'\/]/g, function (c) {
      if (c === "&") return "&" + "amp;";
      if (c === "<") return "&" + "lt;";
      if (c === ">") return "&" + "gt;";
      if (c === '"') return "&" + "quot;";
      if (c === "/") return "&" + "#47;";
      return "&" + "#39;";
    });
  }

  function pageTask() {
    var title = document.title || "";
    var href = location.href || "";
    var node = document.querySelector("article") || document.querySelector("main") || document.body;
    var text = node && node.innerText ? node.innerText : "";
    text = String(text).replace(/\s+/g, " ").slice(0, 700);
    return { title: String(title).slice(0, 160), url: String(href).slice(0, 400), excerpt: text };
  }

  function remnant(el) {
    el.innerHTML = '<div style="font:12px/1.4 ui-sans-serif,system-ui,sans-serif;border:1px dashed #2a3348;padding:12px 14px;color:#9AA4BC;background:#121826">Unsold slot · <a href="/" style="color:#EEF1F7">MULTINICHE AI catalog</a></div>';
  }

  function runBtn() {
    return '<div data-mn-run style="margin-top:10px"><button type="button" style="font:12px ui-sans-serif,system-ui,sans-serif;background:transparent;color:#EEF1F7;border:1px solid #EEF1F7;padding:8px 12px;min-height:44px;cursor:pointer">Run it on this page</button></div>';
  }

  function unit(ad) {
    var host = ad.host || (ad.owned ? "multinicheai.com" : "Sponsored");
    var img = ad.imageUrl
      ? '<img src="' + escapeHtml(ad.imageUrl) + '" alt="" style="width:100%;height:auto;display:block;max-height:180px;object-fit:cover"/>'
      : "";
    var proof = ad.proof && ad.proof.spec ? runBtn() : "";
    if (ad.format === "search") {
      return '<div style="font:14px/1.45 ui-sans-serif,system-ui,sans-serif;border:1px solid #232B3D;padding:12px 14px;background:#121826;color:#EEF1F7">'
        + '<div style="font-size:11px;color:#9AA4BC">Sponsored · ' + escapeHtml(host) + "</div>"
        + '<div style="margin-top:4px;font-weight:600;color:#EEF1F7">' + escapeHtml(ad.headline) + "</div>"
        + '<div style="margin-top:4px;color:#9AA4BC;font-size:13px">' + escapeHtml(ad.body) + "</div>"
        + '<div style="margin-top:8px"><a href="' + escapeHtml(ad.clickUrl) + '" rel="noopener noreferrer" style="color:#FFB020">' + escapeHtml(ad.cta) + " →</a></div>"
        + proof
        + "</div>";
    }
    return '<div style="font:14px/1.45 ui-sans-serif,system-ui,sans-serif;border:1px solid #232B3D;overflow:hidden;background:#121826;color:#EEF1F7">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;font-size:11px;color:#9AA4BC;letter-spacing:.12em;text-transform:uppercase">'
      + "<span>" + escapeHtml(ad.brand || "Sponsored") + "</span><span>MultiNicheADS</span></div>"
      + img
      + (img ? "" : '<div style="padding:16px 14px 8px;font-family:Georgia,ui-serif,serif;font-size:20px;line-height:1.2">' + escapeHtml(ad.headline) + "</div>")
      + '<div style="padding:10px 14px 14px">' + (img ? '<div style="font-weight:600">' + escapeHtml(ad.headline) + "</div>" : "")
      + '<div style="margin-top:4px;color:#9AA4BC;font-size:13px">' + escapeHtml(ad.body) + "</div>"
      + '<div style="margin-top:10px"><a href="' + escapeHtml(ad.clickUrl) + '" rel="noopener noreferrer" style="display:inline-block;background:#FFB020;color:#0A0E16;padding:8px 12px;font-size:12px;text-decoration:none">' + escapeHtml(ad.cta) + "</a></div>"
      + proof
      + "</div></div>";
  }

  function bindRun(el, ad) {
    var box = el.querySelector("[data-mn-run]");
    if (!box || !ad.runUrl) return;
    var btn = box.querySelector("button");
    if (!btn) return;
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (btn.getAttribute("data-busy")) return;
      btn.setAttribute("data-busy", "1");
      btn.textContent = "Running on this page" + String.fromCharCode(8230);
      var payload = pageTask();
      payload.e = ad.eventId || "";
      fetch(ad.runUrl, { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.ok) {
            btn.textContent = "Run it on this page";
            btn.removeAttribute("data-busy");
            return;
          }
          var label = res.live ? "Ran on this page" : "Bound to this page";
          var out = res.output || res.sample || "";
          box.innerHTML = '<div style="padding:10px 0 0;font:12px/1.45 ui-sans-serif,system-ui,sans-serif;color:#EEF1F7"><div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#9AA4BC">' + escapeHtml(label) + '</div><div style="margin-top:6px;white-space:pre-wrap">' + escapeHtml(out) + '</div><button type="button" data-mn-keep style="margin-top:8px;font:12px ui-sans-serif,system-ui,sans-serif;background:transparent;color:#EEF1F7;border:1px solid #EEF1F7;padding:8px 12px;min-height:44px;cursor:pointer">Keep this spec</button><div style="margin-top:8px;font-size:11px;color:#9AA4BC">' + escapeHtml(res.license || "") + "</div></div>";
          var keep = box.querySelector("[data-mn-keep]");
          if (keep && res.spec) {
            keep.addEventListener("click", function (k) {
              k.preventDefault();
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(res.spec);
                keep.textContent = "Spec copied";
              }
            });
          }
        })
        .catch(function () {
          btn.textContent = "Run it on this page";
          btn.removeAttribute("data-busy");
        });
    });
  }

  function fill(el) {
    if (el.getAttribute("data-mn-filled")) return;
    el.setAttribute("data-mn-filled", "pending");
    fetch(ORIGIN + "/api/ads/serve?" + qs(el), { credentials: "omit" })
      .then(function (r) { return r.json(); })
      .then(function (ad) {
        el.setAttribute("data-mn-filled", ad && ad.fill ? "1" : "0");
        if (!ad || !ad.fill) { remnant(el); return; }
        el.innerHTML = unit(ad);
        bindRun(el, ad);
      })
      .catch(function () {
        el.setAttribute("data-mn-filled", "0");
        remnant(el);
      });
  }

  function run() {
    var nodes = document.querySelectorAll("[data-mn-ad]");
    for (var i = 0; i < nodes.length; i++) fill(nodes[i]);
  }

  function boot() {
    run();
    if (window.__mnAdObs) return;
    var obs = new MutationObserver(function () { run(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    window.__mnAdObs = obs;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
