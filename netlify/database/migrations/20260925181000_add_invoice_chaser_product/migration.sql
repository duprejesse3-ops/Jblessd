-- Adds Overdue Invoice Chaser (AI-AB-121) to the catalog. Uses the existing
-- 'finance' niche and 'automations' category — no new enum values needed.
--
-- Ships the same way as the other real-code automation products (Supplier
-- PO & Inventory Sync, Code Review Digest, ...): a runnable Node package the
-- buyer downloads as a .zip, not a document or a Make/Zapier blueprint they
-- assemble themselves. See packages/invoice-chaser/ and
-- netlify/lib/product-archive.mts.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec, time_saved) VALUES
  (
    'AI-AB-121',
    'Overdue Invoice Chaser',
    'automations',
    'finance',
    '.zip · real Stripe + email (Resend), Slack summary optional · one-time license',
    39,
    'Pulls your real open invoices straight from Stripe, works out exactly how many days overdue each one is, and emails escalating reminders — friendly, firmer, final notice — at the thresholds you set, automatically. Not a blueprint you wire yourself in Make or Zapier: a working script from the first run. Tracks what it has already sent per invoice, so a customer three weeks late gets one reminder at the right level of urgency, never a flood of catch-up emails or a repeat of the same one.',
    'Stripe Invoices API lookup + configurable escalation ladder + Resend email (HTML + text) with a link to pay + optional Slack run digest (overdue count, reminders sent, total outstanding) · Node 18+, zero dependencies · GitHub Actions workflow included, runs on a schedule · file-based dedupe state, no database',
    '~15 min saved per overdue invoice, per week'
  )
ON CONFLICT (sku) DO NOTHING;
