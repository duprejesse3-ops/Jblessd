# MultiAds — Content Module (Phase 1)

Self-advertising over paid ads: this generates real SEO landing pages from your
live catalog data instead of buying clicks.

## What it does

1. `content-generator.mjs` groups your `products` table by niche × category,
   sends each group to Claude to write a real landing page (title, meta
   description, body), and stores it in `seo_pages` as a **draft**.
2. You review drafts (`GET /api/ads/pages`) and publish the good ones
   (`POST /api/ads/pages/:slug/publish`).
3. `routes.mjs` serves published pages at `/guides/:niche/:category` and logs
   views to `content_conversions`.
4. When someone claims a free pack or completes an order from one of these
   pages, log that same slug as an event (`free_pack_claim` / `order`) so
   `GET /api/ads/report` tells you **which generated pages are actually
   producing sales** — the thing paid ads made expensive to learn.

## Wiring it in

1. Run `schema.sql` through your existing migration pipeline.
2. `npm install @anthropic-ai/sdk` (pg is already a dependency).
3. Set `ANTHROPIC_API_KEY` in `container/.env` alongside `DATABASE_URL`.
4. Mount the routes in your existing router:
   ```js
   import { servePage, publishPage, listPages, conversionReport } from "./ads/routes.mjs";
   app.get("/guides/:niche/:category", servePage);
   app.get("/api/ads/pages", listPages);
   app.post("/api/ads/pages/:slug/publish", publishPage);
   app.get("/api/ads/report", conversionReport);
   ```
5. First run: `node container/ads/content-generator.mjs --dry-run` to see
   output without writing to the DB, then drop `--dry-run` to actually
   generate and store drafts.
6. Hang it off your existing `ENABLE_SCHEDULER` mechanism to regenerate
   weekly (or whenever the catalog changes) so pages stay current with new
   products automatically.

## Why this order

Content compounds — a published guide keeps bringing traffic for months.
Once this is live and `conversion_report` shows which niche/category pages
convert, that's the signal to decide whether *any* paid channel is even
worth testing, and which one.

## Next pieces (not built yet)

- **Free-pack flywheel**: wire `/api/free-pack` claims to log a
  `content_conversions` event with the referring slug, and add an email
  nurture sequence after claim.
- **Affiliate/referral**: a `referrals` table + a discount-code-on-signup
  flow, paid only on realized sales.
- **Embeddable widget**: a lightweight `<script>` embed of a free
  `/api/run-product` demo, crediting jblessd.com, for customers to put on
  their own sites.
