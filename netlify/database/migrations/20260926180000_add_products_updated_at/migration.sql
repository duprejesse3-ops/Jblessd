-- Adds the `updated_at` column the products table never actually had.
--
-- The PATCH handler in netlify/functions/products.mts has been doing
-- `updated_at = now()` and `RETURNING ... updated_at` since it was written —
-- its own header comment says this is what feeds Product.dateModified in the
-- storefront's JSON-LD and the sitemap's <lastmod>. But `products` was
-- created without that column (see
-- netlify/database/migrations/20260714214923_create_products_table) and no
-- later migration added it, so every PATCH has been failing against a
-- nonexistent column — caught by its try/catch and surfaced to the owner as
-- a generic "Could not save the edit right now", and dateModified/<lastmod>
-- have never had a value to read for any product.
--
-- Backfilled to now() for existing rows (their real edit history isn't
-- recoverable, and "unknown" is worse than a correct-as-of-today baseline —
-- every later real edit updates it going forward from here).

ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

UPDATE products SET updated_at = now() WHERE updated_at IS NULL;
