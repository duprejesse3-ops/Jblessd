ALTER TABLE products ADD COLUMN IF NOT EXISTS time_saved text;

UPDATE products SET time_saved = '~2 hrs/week of manual inbox triage'      WHERE sku = 'AI-AB-002' AND time_saved IS NULL;
UPDATE products SET time_saved = '~3 hrs/week of content scheduling'       WHERE sku = 'AI-AB-005' AND time_saved IS NULL;
UPDATE products SET time_saved = '~1.5 hrs/week of manual follow-up'       WHERE sku = 'AI-AB-010' AND time_saved IS NULL;
UPDATE products SET time_saved = '~2 hrs per PR review cycle'              WHERE sku = 'AI-AB-013' AND time_saved IS NULL;

INSERT INTO products (sku, name, category, niche, format, price, blurb, spec, time_saved) VALUES
  (
    'AI-AB-071',
    'Local SEO Agency Blueprint',
    'automations',
    'marketers',
    '5 Make.com blueprints + Notion report template · one-time license',
    75,
    'Before you buy: try it on a real client site and watch it actually fetch and parse that page live — title, meta, schema, alt text, robots/sitemap — not a script reading out a canned script. Then the full system to run a local-SEO service on: that real audit, a Google Business Profile checklist, automated review-response drafts, a white-label monthly report, and the outreach script to land the first client. One license, unlimited clients — you are the agency.',
    'Live on-page scan (title/meta/schema/alt/robots, fetched for real) + GBP checklist + review-response automation + white-label report + outreach script · unlimited clients',
    '~6 hrs saved per client per month'
  ),
  (
    'AI-PP-116',
    'Faceless Video Script-to-B-Roll Prompt Kit',
    'prompts',
    'writers',
    '40 prompts · PDF + Notion',
    24,
    'Script the hook, generate matched B-roll prompts for Runway or Midjourney, and get a shot list out the other end — built for faceless short-form channels so the visuals stop being an afterthought.',
    'Hook scripts + Runway/Midjourney B-roll prompts + shot-list export',
    NULL
  ),
  (
    'AI-AG-117',
    'Brand Voice Memory Block',
    'agents',
    'marketers',
    'System prompt + Notion database template',
    27,
    'Stores each client''s brand voice as a structured, reusable memory block instead of a paragraph pasted into every prompt — so an agency''s output stops drifting toward generic AI text as accounts pile up.',
    'Brand-voice intake → structured memory block → consistent output across writers',
    '~1 hr saved per piece of client content'
  )
ON CONFLICT (sku) DO UPDATE SET
  name       = EXCLUDED.name,
  category   = EXCLUDED.category,
  niche      = EXCLUDED.niche,
  format     = EXCLUDED.format,
  price      = EXCLUDED.price,
  blurb      = EXCLUDED.blurb,
  spec       = EXCLUDED.spec,
  time_saved = EXCLUDED.time_saved;
