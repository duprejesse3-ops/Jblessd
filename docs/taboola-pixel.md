# Taboola pixel

Account **2081418** (`duprejesse3@gmail.com`). Implemented in
[`/taboola-pixel.js`](../taboola-pixel.js) and included on every public page.

## Where it is installed

| Surface | File |
| --- | --- |
| Storefront | `index.html` |
| Agent studio | `agent.html` |
| Policy pages | `terms/`, `privacy-policy/`, `refund-policy/` |
| SEO pages (`/product/*`, `/tools/*`, `/proof*`, `/use-cases*`, `/updates*`, `/free-tool`) | `netlify/edge-functions/pages.ts` |

`admin.html` is deliberately excluded — it is the owner's private console, so its
visits would inflate audiences and skew conversion rates.

## Events

`page_view` fires on every page. Funnel events reach Taboola through the shared
`window.trackMarketingEvent` hub in `marketing-measurement.js`, which forwards to
`window.trackTaboolaEvent`; that function maps the site's GA4-style names onto
Taboola's vocabulary (`begin_checkout` → `start_checkout`, `purchase` →
`make_purchase`, `generate_lead` → `lead`, and so on) and passes order value as
`revenue`, which is the field Taboola bids on. The storefront's Stripe purchase
conversion is sent from `reportPurchaseConversion()` in `index.html` using the
server-verified order total.

To add an event, emit it through `trackMarketingEvent` as usual — no Taboola-specific
call is needed. Only add a name to the map in `taboola-pixel.js` if Taboola has a
matching standard event.

## Consent

Taboola has no Consent Mode equivalent, so consent is enforced by withholding the
library rather than by muting it. `taboola-pixel.js` mirrors the regional defaults in
`privacy-consent.js`: an explicit banner choice always wins, and an undecided visitor
is treated as consent-required only in the European regions that script gates on.
Events queue on `window._tfa` regardless — that is inert — and flush if and when the
library is allowed to load.

## CSP

`netlify/edge-functions/csp.ts` allowlists `cdn.taboola.com`, `trc.taboola.com` and
`*.taboola.com` in `script-src`, `script-src-elem`, `connect-src`, `frame-src` and
`img-src`. A missing host here does not raise an error on the page — the pixel simply
reports nothing.

## Vendor snippet as supplied

The installed loader is the snippet below, restructured so the library load can be
consent-gated and the account ID lives in one place.

```html
<!-- Taboola Pixel Code -->
<script type='text/javascript'>
  window._tfa = window._tfa || [];
  window._tfa.push({notify: 'event', name: 'page_view', id: 2081418});
  !function (t, f, a, x) {
         if (!document.getElementById(x)) {
            t.async = 1;t.src = a;t.id=x;f.parentNode.insertBefore(t, f);
         }
  }(document.createElement('script'),
  document.getElementsByTagName('script')[0],
  '//cdn.taboola.com/libtrc/unip/2081418/tfa.js',
  'tb_tfa_script');
</script>
<!-- End of Taboola Pixel Code -->
```
