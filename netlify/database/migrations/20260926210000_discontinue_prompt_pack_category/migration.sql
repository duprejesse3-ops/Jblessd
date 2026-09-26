-- Discontinues the entire "prompts" product category (17 SKUs) as the store
-- repositions around real automations and software rather than static
-- prompt packs. Owner's call: no live customers on these SKUs yet, so a hard
-- delete is safe -- see the matching removal from
-- netlify/lib/catalog.mts's FALLBACK_CATALOG.
--
-- Deliberately NOT replaced with 301 redirects from the old /product/:sku
-- URLs: netlify/edge-functions/pages.ts already has an established,
-- documented convention for a delisted product (see notFound() and its
-- comment) -- return a real HTTP 404 with a noindex directive so Google
-- drops the URL, rather than redirect to a loosely-related page. Google's
-- own guidance treats a forced redirect from genuinely discontinued content
-- to an unrelated page as a soft-404 signal, which is worse for the site
-- than a clean 404 -- so this migration relies on that existing behavior
-- instead of adding redirect rules.
--
-- One niche, "writers", had exactly 3 products and all 3 were prompt packs
-- (AI-PP-116, AI-PP-011, AI-PP-029) -- deleting them would have left
-- /tools/writers with zero products. renderNiche() already 404s an empty
-- niche safely, but the "Browse by role" nav still linked to it, so
-- netlify/edge-functions/pages.ts also drops "writers" from NICHE_LABEL /
-- NICHE_INTRO / NICHE_FAQ in this same change set (no DB change needed for
-- that part -- it's a static nav list, not catalog data). Every other niche
-- keeps at least 4 products after this delete.
--
-- No foreign-key constraints reference products.sku (checked proofs.sku and
-- seo_pages.product_skus -- both plain text columns, not FKs), so this
-- delete cannot fail on a constraint. Existing "Live Proof" runs or guide
-- pages that happen to reference one of these SKUs by name are left as-is;
-- they were generated content, not something this migration can safely
-- rewrite, and none of them link back to a product page that still exists
-- to be broken by this.
DELETE FROM products WHERE sku IN (
  'AI-PP-116',
  'AI-PP-001',
  'AI-PP-006',
  'AI-PP-011',
  'AI-PP-014',
  'AI-PP-025',
  'AI-PP-029',
  'AI-PP-032',
  'AI-PP-038',
  'AI-PP-042',
  'AI-PP-043',
  'AI-PP-046',
  'AI-PP-050',
  'AI-PP-061',
  'AI-PP-062',
  'AI-PP-019',
  'AI-PP-021'
);
