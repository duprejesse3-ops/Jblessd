# NicheAds — full delivery (CPC conversion + billing + dashboard)

This zip is cumulative and self-contained: everything from every round so
far, merged into final files. You don't need any earlier patch/zip.

## Files

```
netlify.toml                                                              (edited — see note below)
netlify/database/migrations/20260921180000_ads_network_cpc_pricing.sql    (new)
netlify/database/migrations/20260921190000_ads_network_budget_topups.sql (new)
netlify/functions/ads-network-slots.mts       (moved from repo root, unchanged)
netlify/functions/ads-network-campaigns.mts   (moved + edited)
netlify/functions/ads-network-serve.mts       (moved + edited)
netlify/functions/ads-network-click.mts       (moved + edited)
netlify/functions/ads-network-price.mts       (new — daily CPC pricing job)
netlify/functions/ads-network-fund.mts        (new — Stripe funding checkout)
netlify/functions/ads-network-signup.mts      (new — the missing tenant-signup endpoint)
netlify/functions/webhook.mts                 (edited — credits funded budget)
nicheads.html                                 (new — tenant dashboard)
```

⚠️ **`netlify.toml` is a shared config file** — only two small blocks changed
(a `/nicheads` redirect + two `Cache-Control` header blocks, both placed
right next to the existing `/ads` entries they mirror). Diff it against your
current one rather than blindly overwriting, in case you've since made other
unrelated edits to it.

Delete the four stale root-level copies (`ads-network-slots.mts`,
`ads-network-campaigns.mts`, `ads-network-serve.mts`, `ads-network-click.mts`)
once you've copied the `netlify/functions/` versions in.

## What's new this round

**The signup gap.** Nothing in the repo could actually create a new tenant —
not a public endpoint, not the admin console. Only the seeded self-tenant
existed. `ads-network-signup.mts` is the fix: `POST /api/ads/network/signup`
with `{name, email, siteUrl}` → creates a tenant, returns a raw `mnads_...`
key exactly once (only its hash is stored — same "key is the account, no
password" pattern as your Claude Agent Studio credits system).

**The dashboard, `nicheads.html`.** Static page at the repo root, styled with
your existing theme tokens (pulled from `agent.html`'s `:root` — Fraunces/
Inter/JetBrains Mono, the same dark palette). No server-side session, same
as `/agent`: the access key is pasted or auto-filled from `localStorage`,
and every request just sends it as `x-ads-key`. Reachable at `/nicheads`
(redirect added in `netlify.toml`, matching how `/agent` and `/ads` work).

What it does:
- Sign up → shows the key once, with a "save this now" warning, auto-fills
  it into the sign-in field.
- Sign in → loads campaigns + slots for that key.
- Create a campaign → same fields as the API (`productName`, `brief`,
  `goal`, `clickUrl`, `niche`, planned budget in USD) → Claude writes the
  copy, shows impressions/clicks/CTR/price-per-click/spend once created.
- Pause/resume a campaign.
- Fund a campaign → prompts for a USD amount (min $5), redirects to Stripe
  Checkout; funding lands via the same webhook path as before, so returning
  to the dashboard after paying shows the updated budget.
- Create a slot → shows the embed `<script>` snippet immediately, ready to
  paste onto the tenant's own site.

## Deploy steps

1. Copy files in (mind the `netlify.toml` note above), delete the four
   stale root copies.
2. Run both migrations if you haven't already from the last round.
3. No new env vars — signup reuses `@netlify/database`, funding reuses
   `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, campaign creation reuses
   `ANTHROPIC_API_KEY`.
4. Visit `/nicheads`, sign up, create a campaign, create a slot on a second
   tenant, confirm cross-tenant serving works (remember: a slot never shows
   its own tenant's campaigns — you need at least two tenants to see a live
   ad).

## Still not built (flagging, not blocking)

- No password reset / key rotation UI — a lost key means signing up again
  as a new tenant. Same limitation the credits system already has.
- No campaign editing (price, creative, click URL) after creation — only
  status toggle and funding. Would need a PATCH extension if you want it.
- No listing of past top-up payments in the dashboard — `ads_network_budget_topups`
  has the data, just nothing surfaces it yet.
- Fee handling and refund/cancellation on funded-but-unspent budget are
  still open questions from the last round — worth deciding before this
  handles real advertiser money at any volume.
