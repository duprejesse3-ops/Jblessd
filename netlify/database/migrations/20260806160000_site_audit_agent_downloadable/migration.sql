-- Updates the Site Audit Agent's copy now that it ships as a downloadable
-- archive with an installer rather than as source to copy out of a document.
--
-- The product gained install.sh (a one-command install that puts a `site-audit`
-- binary on PATH) and a real .zip served by /api/download, so the format and
-- blurb the storefront shows were describing an older, worse experience. The
-- blurb also said "three schedulers" — there are four counting the plain CLI,
-- and the installer prints all of them on completion.
--
-- Roll-forward only: 20260806120000_add_site_audit_agent_product.sql is already
-- applied and is left untouched. This is a narrow UPDATE against one SKU rather
-- than an edit to that migration. It is naturally idempotent — re-running sets
-- the same values — and it is scoped by `WHERE sku`, so it cannot touch another
-- product or a row an owner listed themselves.
--
-- Nothing here changes price, category, or niche; only the two customer-facing
-- description fields.
UPDATE products
SET
  format = '.zip download · one-command install · zero dependencies · perpetual license',
  blurb = 'The maintenance agent that watches this store, rebuilt to run on any site. Unzip, run ./install.sh, and you have a site-audit command. Sixteen checks, four schedulers, no account and no subscription — you own the code.'
WHERE sku = 'AI-AG-065';
