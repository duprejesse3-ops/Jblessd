-- Adds Broken Link & Uptime Watchdog (AI-AB-122) to the catalog. Uses the
-- existing 'developers' niche and 'automations' category — no new enum
-- values needed.
--
-- Ships the same way as the other real-code automation products (Supplier
-- PO & Inventory Sync, Overdue Invoice Chaser, ...): a runnable Node
-- package the buyer downloads as a .zip, not a document or a Make/Zapier
-- blueprint they assemble themselves. See packages/link-watchdog/ and
-- netlify/lib/product-archive.mts.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec, time_saved) VALUES
  (
    'AI-AB-122',
    'Broken Link & Uptime Watchdog',
    'automations',
    'developers',
    '.zip · real sitemap crawl + email (Resend), Slack summary optional · one-time license',
    29,
    'Reads your real sitemap.xml, checks every URL it lists against your real site — HEAD requests, falling back to GET, concurrency-limited so it stays a polite crawl — and optionally follows the outbound links found on those pages too. Emails you an actual digest of what''s broken, with counts by error type and which page linked to it, automatically. Not a blueprint you wire yourself in Make or Zapier: a working script from the first run. No per-page pricing, no seat limit, no dashboard login — just a scheduled job on infrastructure you already have.',
    'Sitemap.xml (and sitemap-index) crawl + HEAD/GET link + uptime checks + optional outbound-link scan + Resend email digest (HTML + text) + optional Slack run summary · Node 18+, zero dependencies · GitHub Actions workflow included, runs on a schedule',
    '~30 min saved per manual link-audit pass'
  )
ON CONFLICT (sku) DO NOTHING;
