-- Adds Supplier PO & Inventory Sync (AI-AB-119) to the catalog. Uses the
-- existing 'stores' niche and 'automations' category — no new enum values
-- needed (unlike the Fieldhand migration, which introduced 'contractors').
--
-- Ships the same way as the other real-code automation products (Code
-- Review Digest, Incident Postmortem Automation, ...): a runnable Node
-- package the buyer downloads as a .zip, not a document or a Make/Zapier
-- blueprint they assemble themselves. See packages/supplier-po-sync/ and
-- netlify/lib/product-archive.mts.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec, time_saved) VALUES
  (
    'AI-AB-119',
    'Supplier PO & Inventory Sync',
    'automations',
    'stores',
    '.zip · real Shopify + email (Resend), Slack summary optional · one-time license',
    39,
    'Checks your real Shopify stock against reorder thresholds you set, and when one''s crossed, builds and emails an actual purchase order — a real line-item CSV, a real email, to the real supplier — automatically. Not a blueprint you wire yourself in Make or Zapier: a working script from the first run. Multiple low SKUs for the same supplier get combined into one PO, not a flood of separate emails. Pairs with MultiConnect: Shopify if you own it, runs standalone if you don''t.',
    'Shopify Admin API stock lookup + Resend email with CSV attachment + optional Slack run summary · Node 18+, zero dependencies · GitHub Actions workflow included, runs on a schedule',
    '~20 min saved per reorder cycle, per supplier'
  )
ON CONFLICT (sku) DO NOTHING;
