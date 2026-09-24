-- Adds the File Organizer Agent — a real, zero-dependency Node CLI product
-- (packages/file-organizer-agent/), not an AI-generated agent config. It
-- gets its own interactive "run it as an app" form (see product-app.mts's
-- SKU_APPS['AI-AG-093']) that builds a setup plan grounded in the buyer's
-- platform, and its deliverable is the embedded real source
-- (netlify/lib/file-organizer-source.mts), not AI-generated content.
--
-- Same pattern as the earlier waves: roll-forward only, ON CONFLICT DO
-- NOTHING keeps it idempotent. SKU continues on from the language products
-- wave (090-092), so 093.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-AG-093', 'File Organizer Agent', 'agents', 'office', 'Zero-dependency Node CLI + adapters', 19, 'Sorts a messy folder into categorized subfolders — Documents, Images, Invoices & Receipts, Screenshots, and more — automatically, on your own machine. No account, no API key required, nothing phoning home. Dry-run by default, so nothing moves until you say so.', 'Rule-based classification + optional AI fallback; cron, launchd, and Windows Task Scheduler adapters included')
ON CONFLICT (sku) DO NOTHING;
