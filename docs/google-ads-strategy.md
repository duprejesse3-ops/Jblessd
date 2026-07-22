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

## 3a. First-party ad-performance dataset (implemented on the site)

Google Ads reporting lives inside Google's account, browser conversions are lost
to ad blockers and closed tabs, and neither gives you a copy of the data you can
slice yourself. The site now keeps its **own** first-party record of what drives
revenue, in the Netlify Database `ad_events` table:

- **Landings** — when a visit arrives carrying a Google Ads click id
  (`gclid` / `gbraid` / `wbraid`) or `utm_*` campaign params, the page posts a
  small, PII-free beacon to `POST /api/track-landing` that records the click id,
  campaign/source/keyword, landing path, referrer host, and a coarse device
  class. This is the **traffic** side — the denominator for conversion rate.
- **Purchases** — the Stripe webhook (`checkout.session.completed`) writes one
  `purchase` row per paid order **server-side**, carrying the real order value
  plus the ad click id and campaign captured at checkout. Because it fires from
  the webhook it survives closed tabs and blocked pixels, and a unique index on
  the session id makes Stripe's retries idempotent (no double-counting).

No email, name, IP, or address is stored — only the attribution signals needed
to answer "which campaign / keyword / landing page actually converts."

### Reading the data

- `GET /api/ad-performance?days=30` (owner-only, behind the `/admin` session)
  returns the aggregated report: totals (landings, purchases, revenue,
  conversion rate, average order value) and breakdowns **by campaign**, **by
  source**, **by landing page**, and **by day**.
- The `/admin` AI workstation has a matching read-only `ad_performance` tool, so
  you can just ask it *"how are my ads doing?"* or *"which campaign converts
  best?"* and get the numbers back from the live table.

### How this feeds the strategy

This is the data the bid strategy in §2 is tuned on. Use it to spot which
campaigns produce real revenue (not just clicks), which landing pages convert,
and where to push or pull spend — then act on it in the Google Ads UI. Under
Google's auto-tagging the campaign/keyword breakdown for `gclid`-only traffic
lives in Google Ads itself; the stored click id is the join key for an offline /
enhanced conversion upload (see §4).

> Scope: the landing beacon fires on the storefront homepage (the primary ad
> landing page). The purchase/revenue side is captured server-side for **every**
> order regardless of which page the buyer landed on.

---

## 4. Next steps for maximum accuracy (optional, recommended once live)

- **`gclid` capture (implemented):** the storefront now reads the Google Ads
  click identifier (`gclid`, or `gbraid` / `wbraid` on privacy paths) from the
  landing URL, persists it for 90 days, and attaches it to the paid Stripe
  session as `ad_click_id` metadata. This ties each purchase to the exact ad
  click. It stays empty for buyers who didn't arrive from an ad and is never
  used for pricing. To activate reporting, set the tag IDs in Netlify (see the
  environment-variables table above) — the code is a no-op until then.
- **Enhanced conversions:** hash and send the buyer email from the success page
  (available in the Stripe session) to recover conversions lost to cookie
  restrictions. Improves Smart Bidding accuracy noticeably.
- **Server-side conversions via the webhook:** `netlify/functions/webhook.mts`
  already receives `checkout.session.completed` reliably (survives closed tabs).
  The `ad_click_id` now stored on the session metadata is exactly what an
  offline / enhanced conversion import needs — sending the conversion from the
  webhook using the Google Ads API removes dependence on the browser entirely
  (the most robust setup).
