-- Adds an optional `meta_description` column, separate from `blurb`.
--
-- `blurb` is the on-page product description shown to a buyer deciding
-- whether to purchase — it's supposed to be thorough, and several run
-- 300-600+ characters (Fieldhand, File Organizer Agent, MultiVault, etc.).
-- That's fine on the page itself, but `netlify/edge-functions/pages.ts` was
-- feeding the SAME text into <meta name="description">, og:description, and
-- twitter:description, where Google/social crawlers just truncate it
-- mid-sentence at ~155-160 characters — the exact snippet a searcher decides
-- whether to click sees a sentence cut off arbitrarily.
--
-- Backfilled here only for the 27 products whose blurb exceeds ~160 chars;
-- each meta_description is a short (~120-150 char), non-invented summary of
-- what that same blurb already says, written to read as a complete sentence
-- when truncated rather than an arbitrary cutoff. Products with a blurb
-- already under ~160 chars are left NULL — the code falls back to using
-- blurb directly for those, so nothing changes for them.

ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description text;

UPDATE products SET meta_description = 'Leave Netlify or Shopify — load your GitHub on a Pi or laptop, add your Stripe key, and take payments on hardware you own.' WHERE sku = 'AI-HOST-001';
UPDATE products SET meta_description = 'An outbound proxy in front of every AI call on your Host machine. Nothing leaves by default, with a receipt for what did.' WHERE sku = 'AI-HOST-002';
UPDATE products SET meta_description = 'Evolves proof-first ad copy on autopilot from real search intent — matches pain points to SKUs and kills losing variants automatically.' WHERE sku = 'AI-AB-070';
UPDATE products SET meta_description = 'Run a local-SEO agency on one system: a live on-page audit, a GBP checklist, review-response drafts, a white-label report, and outreach.' WHERE sku = 'AI-AB-071';
UPDATE products SET meta_description = 'Scripts the hook and generates matched Runway/Midjourney B-roll prompts plus a shot list — built for faceless short-form channels.' WHERE sku = 'AI-PP-116';
UPDATE products SET meta_description = 'Stores each client''s brand voice as a reusable memory block instead of a pasted paragraph, so agency output stops drifting toward generic AI text.' WHERE sku = 'AI-AG-117';
UPDATE products SET meta_description = 'Drafts contractor correspondence — RFIs, claims, change orders — in plain contractor voice, then scrubs stock AI phrasing before it leaves the page.' WHERE sku = 'AI-AG-118';
UPDATE products SET meta_description = 'Watches your real Shopify stock against reorder thresholds and auto-emails a real purchase order to your supplier when one''s crossed.' WHERE sku = 'AI-AB-119';
UPDATE products SET meta_description = 'Sorts a messy folder into categorized subfolders by filename and extension. Dry-run by default — nothing moves until you approve it.' WHERE sku = 'AI-AG-120';
UPDATE products SET meta_description = 'Pulls open invoices from Stripe and emails escalating reminders — friendly, firmer, final notice — at the thresholds you set, automatically.' WHERE sku = 'AI-AB-121';
UPDATE products SET meta_description = 'Crawls your real sitemap, checks every URL against your live site, and emails a digest of what''s broken and where it''s linked from.' WHERE sku = 'AI-AB-122';
UPDATE products SET meta_description = 'A coding bot that plans vehicle routes, then proposes structurally different alternatives with real routing libraries, not near-identical heuristics.' WHERE sku = 'AI-AG-067';
UPDATE products SET meta_description = 'Posts a prioritized GitHub PR digest to Slack on a schedule, flags what needs a human today, and says plainly when nothing does.' WHERE sku = 'AI-AB-013';
UPDATE products SET meta_description = 'Fires on every GitHub Release: drafts customer-facing notes and a Slack summary from your merged PRs, then commits CHANGELOG.md automatically.' WHERE sku = 'AI-AB-028';
UPDATE products SET meta_description = 'Checks live headlines and Reddit discussion for a plausible link to a metric that moved in your business — timing-checked, never proof.' WHERE sku = 'AI-AG-115';
UPDATE products SET meta_description = 'Runs your idea through an architect-builder-critic cascade — honest passes, and a critic that must name a real flaw before it ships.' WHERE sku = 'AI-AG-112';
UPDATE products SET meta_description = 'Shows the real tradeoffs instead of a confident verdict, flags its own uncertainty, and never acts on your behalf — only prepares the decision.' WHERE sku = 'AI-AG-113';
UPDATE products SET meta_description = 'Turns an incident timeline into a blameless postmortem draft with owners assigned automatically, the moment PagerDuty marks it resolved.' WHERE sku = 'AI-AB-037';
UPDATE products SET meta_description = 'AI office hours that only know your syllabus — refuses to invent a policy or finish your problem, and defers to your professor when it can''t help.' WHERE sku = 'AI-AG-111';
UPDATE products SET meta_description = 'Checks a Polymarket link''s live price against recent headlines and flags a real divergence between the public case and the price — never a trade.' WHERE sku = 'AI-AG-114';
UPDATE products SET meta_description = 'The same site-audit agent that maintains this store, rebuilt to run on any site — sixteen checks, no account, no subscription, you own the code.' WHERE sku = 'AI-AG-065';
UPDATE products SET meta_description = 'One dashboard for every MultiConnect tool you run, with one button to switch them all to read-only during an incident.' WHERE sku = 'AI-CN-007';
UPDATE products SET meta_description = 'A local, encrypted, BM25-searchable context snapshot of a folder and calendar — served to Claude Desktop and other MCP tools, no cloud.' WHERE sku = 'AI-CN-008';
UPDATE products SET meta_description = 'Exports Google Docs to real local markdown files on a schedule — read-only Drive access, revocable anytime, zero npm dependencies.' WHERE sku = 'AI-CN-009';
UPDATE products SET meta_description = 'Translates any chat or call transcript in real time, both directions, keeping tone, urgency, and intent intact — not just literal words.' WHERE sku = 'AI-AG-090';
UPDATE products SET meta_description = 'Rebuilds your English marketing copy for a target market — idiom, humor, and cultural references swapped, ready to publish, not to be corrected.' WHERE sku = 'AI-AG-091';
UPDATE products SET meta_description = 'Drafts your reply in a customer''s own language the moment they message you, matched to your tone, so you never lose a lead to a language gap.' WHERE sku = 'AI-AG-092';
