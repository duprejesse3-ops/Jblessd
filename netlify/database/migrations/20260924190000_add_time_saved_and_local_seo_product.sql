-- 1) Adds an optional `time_saved` column to products — a short, concrete
--    estimate of setup/manual time the tool saves (e.g. "~3.5 hrs per setup").
--    Nullable and additive: existing rows are untouched until backfilled, and
--    the storefront only renders the spec-sheet line when it's present.
--
-- 2) Backfills it on a handful of existing Automation Blueprint products,
--    where "how much time does this actually save me" is the real objection
--    at checkout.
--
-- 3) Adds three products from the "trending product gaps" pass:
--
--    AI-AB-071 "Local SEO Agency Blueprint" — expanded from a single
--    one-off audit workflow into the system to actually run a local-SEO
--    service on: the Maps/competitor audit, a Google Business Profile
--    optimization checklist, automated review-response drafting, a
--    white-label monthly client report, and the cold-outreach script to
--    land the first client. Priced as a service-in-a-box (one license,
--    unlimited clients), not a single-use blueprint — this is the
--    "productize it like a real business" version of the original idea.
--
--    AI-PP-116 "Faceless Video Script-to-B-Roll Prompt Kit" — prompts tuned
--    for short-form video creators: hook scripts plus matched Runway/
--    Midjourney B-roll prompts and a shot list, so the visual side isn't
--    left to guesswork after the script's written.
--
--    AI-AG-117 "Brand Voice Memory Block" — a system prompt + Notion
--    database pattern that stores a client's brand voice as structured,
--    reusable memory instead of a paragraph re-pasted into every prompt,
--    aimed at agencies juggling more than one client's voice.
--
-- Roll-forward only, idempotent. AI-AB-071 was never inserted by an earlier
-- migration (it only ever existed in a prior draft of this same file), so
-- this is a plain first insert, not an update to a live row.

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
ON CONFLICT (sku) DO NOTHING;
