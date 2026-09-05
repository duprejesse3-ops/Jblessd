-- Adds MultiConnect: Google Docs (AI-CN-009) to the catalog.
--
-- Real, tested source: one-way, read-only export of Google Docs to local
-- markdown files, on a schedule (cron/launchd/Task Scheduler adapters
-- included) — closes the specific gap MultiVault's own README documents
-- honestly: Drive Desktop sync does NOT turn a native Google Doc into a
-- readable local file (it syncs a small pointer file, not the content).
-- This does the actual export, server-side via Google's own Drive API.
--
-- Filed under the existing 'connectors' category, matching its siblings
-- (Zapier/Webhook Bridge, Shopify, Sheets/Airtable, Email/CRM, Slack/
-- Discord) — same one-time-license, downloadable-app pattern. Niche is
-- 'founders' rather than 'office', matching MultiVault's own audience
-- (consultants/freelancers with client work living in Google Docs) since
-- this is positioned as MultiVault's companion, not a general office tool.
--
-- Priced at $39 — between Zapier/Webhook Bridge ($29, no OAuth) and Shopify
-- ($59, OAuth + read/write scopes); Sheets/Airtable ($35) is the closest
-- complexity match, priced a little above it for the real OAuth flow this
-- one implements from scratch (zero dependencies, no googleapis SDK).
--
-- Idempotent via ON CONFLICT (sku) DO NOTHING, consistent with every other
-- product-add migration in this repo.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-CN-009', 'MultiConnect: Google Docs', 'connectors', 'founders', '.zip download · zero dependencies · perpetual license', 39, 'Exports Google Docs to local markdown files, one-way, on a schedule — so local-file tools (like MultiVault, sold separately) can see content that otherwise only exists in a Google Doc. Drive Desktop sync alone does not do this: a synced .gdoc is a pointer file back to Google''s servers, not the document''s actual content. This asks Google to convert each Doc to plain markdown server-side and writes the real result to a local folder you choose. Read-only Drive access, revocable anytime, zero npm dependencies.', 'OAuth2 (installed-app flow) · Drive API v3 (read-only) · incremental export by modifiedTime · cron/launchd/Task Scheduler adapters included')
ON CONFLICT (sku) DO NOTHING;
