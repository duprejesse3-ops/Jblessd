# Google Ads — Advanced Bid Strategy & Conversion Tracking

This document describes the recommended **advanced (Smart) bid strategy** for the
MULTINICHE AI storefront and the **value-based conversion tracking** that the site
now sends to Google Ads and GA4 to make that strategy work.

Bid strategies are configured inside the Google Ads UI — they can't be set from
code. What *can* (and now does) live in code is the conversion tracking that feeds
the strategy. Smart Bidding is only as good as the conversion data behind it, so
the tracking below is the prerequisite for everything in the strategy section.

---

## 1. Conversion tracking (implemented on the site)

The storefront had **no analytics or conversion tracking** before this change.
It now reports a **value-based purchase conversion** end to end:

1. **Public tag IDs come from environment variables**, served by
   `GET /api/analytics-config`. This keeps the same code working against a test
   and a live Google Ads account, and the tag stays a no-op until the IDs are set.
2. **gtag.js loads in the page `<head>`** only when the IDs are configured
   (GA4 + Google Ads).
3. **On a successful checkout return**, the page fetches the real order total
   from Stripe via `GET /api/checkout-summary?session_id=…` and fires:
   - a GA4 `purchase` event, and
   - a Google Ads `conversion` event
   both carrying the **real order value, currency, and a `transaction_id`** for
   de-duplication.

Reporting the true order value (not a flat `1.0`) is the whole point: value-based
bid strategies need per-order value to optimize toward high-value carts.

### Environment variables to set (Netlify → Site settings → Environment variables)

These are public identifiers, not secrets, but keeping them in env vars avoids
hard-coding an account into the source.

| Variable | Example | Where to find it |
| --- | --- | --- |
| `GA4_MEASUREMENT_ID` | `G-XXXXXXXXXX` | GA4 → Admin → Data streams |
| `GOOGLE_ADS_ID` | `AW-123456789` | Google Ads → Goals → Conversions → your Google tag |
| `GOOGLE_ADS_PURCHASE_LABEL` | the label of the **Purchase** conversion action | Google Ads → the Purchase conversion action → *Tag setup → Use Google tag* → the value after the `/` in `send_to` |

Until these are set the site behaves exactly as before — no tag loads and no
events fire.

### One-time setup in Google Ads

1. Create a **Purchase** conversion action (category: *Purchase*), goal type
   **Website**, with **"Use different values for each conversion"** enabled so the
   value we send is used, and count = **One** (one conversion per order).
2. Link Google Ads ↔ GA4 and (optionally) import the GA4 `purchase` event as a
   secondary signal. Use one primary purchase conversion for bidding to avoid
   double-counting.
3. Turn on **Enhanced conversions** later for accuracy — see section 4.

### How to verify it's working

- Open the site with `?debug` in Google Tag Assistant / the GA4 DebugView.
- Complete a **Stripe test-mode** checkout. On return to
  `/?checkout=success&session_id=…` confirm a `purchase` event fires with the
  correct `value` and `currency`, and a Google Ads `conversion` hit with the same
  `transaction_id`.
- In Google Ads, the Purchase conversion action should move from *"No recent
  conversions"* to *"Recording conversions"* within ~24–48h of live traffic.

---

## 2. Recommended advanced bid strategy

The catalog is priced from ~$14 to ~$49 with an automatic 15% bundle discount, so
order values vary meaningfully. That variance is exactly what a **value-based**
strategy exploits.

### Phase 0 — Bootstrap (first ~2 weeks, until ~15 conversions / 30 days)
Smart Bidding needs conversion history before it can predict. Start on:
- **Maximize Conversions** with a **manual CPC-informed daily budget**, or
- **Maximize Conversion Value** with **no** target at first.

Let it gather data. Don't set a target ROAS yet — an early target starves the
campaign of the volume it needs to learn.

### Phase 1 — Advanced strategy (once you have ~15+ conversions in 30 days)
Switch to **Maximize Conversion Value with a Target ROAS (tROAS)**.

- **Why value-based, not Target CPA:** orders range from ~$14 to bundles of $40+.
  Target CPA treats a $14 sale and a $49 bundle identically; Target ROAS bids up
  for the searches likely to produce larger carts. This is why the site now sends
  the real order value.
- **Setting the first target:** compute recent *conversion value ÷ ad spend* over
  the bootstrap period and set tROAS slightly **below** that observed number so the
  algorithm isn't immediately constrained. Example: if observed ROAS is 400%, set
  the target near 300–350% and tighten over time.
- **Adjust in small steps** (±10–15%) no more than every 1–2 weeks; every change
  triggers a new ~1 week learning period.

### Guardrails & structure
- Keep enough **budget headroom** (roughly ≥ 2× the current daily spend) so tROAS
  isn't budget-limited.
- **Segment campaigns by margin/intent**, not by tiny keyword groups — e.g. a
  brand campaign, a high-intent generic campaign, and a bundle/upsell campaign —
  so each can hold its own target.
- Feed value with **Enhanced conversions** and **product-level values** for the
  strongest signal (section 4).
- Add **conversion value rules** if certain geos/devices are worth more.

### When to prefer other strategies
- **Maximize Conversion Value (no target):** when the goal is to spend a fixed
  budget as efficiently as possible (brand-awareness or launch pushes).
- **Target CPA:** only if you later sell a single fixed-price offer where every
  conversion is worth the same — not the case for this catalog.

---

## 3. Data flow summary

```
Buyer completes Stripe Checkout
   → returns to /?checkout=success&session_id=cs_...
      → GET /api/checkout-summary  (server verifies payment_status=paid, returns value+currency)
         → gtag GA4 'purchase'  { transaction_id, value, currency }
         → gtag Ads 'conversion' { send_to, transaction_id, value, currency }
            → Google Ads Smart Bidding (Maximize Conversion Value / Target ROAS)
```

The server (`/api/checkout-summary`) is the source of truth for value — the
browser never decides the amount, which prevents inflated or spoofed conversion
values.

---

## 4. Next steps for maximum accuracy (optional, recommended once live)

- **Enhanced conversions:** hash and send the buyer email from the success page
  (available in the Stripe session) to recover conversions lost to cookie
  restrictions. Improves Smart Bidding accuracy noticeably.
- **Server-side conversions via the webhook:** `netlify/functions/webhook.mts`
  already receives `checkout.session.completed` reliably (survives closed tabs).
  Sending the conversion from there using the Google Ads API / offline conversion
  import removes dependence on the browser entirely — the most robust setup.
- **`gclid` capture:** persist the `gclid` URL parameter on landing and attach it
  to the order so offline/enhanced conversions attribute to the exact click.
