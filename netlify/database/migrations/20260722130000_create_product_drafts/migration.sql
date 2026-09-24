-- Stores product listings designed by the AI Product Builder agent. The owner
-- gives the agent a plain-English brief ("a $20 pack for freelance video
-- editors") and it drafts a complete, catalog-grounded listing here so the
-- draft survives reloads and can be reviewed before being promoted into the
-- live `products` catalog. These are proposals only — they are never served to
-- shoppers until an owner copies them into the catalog.
CREATE TABLE IF NOT EXISTS "product_drafts" (
	"id" serial PRIMARY KEY,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"niche" text NOT NULL,
	"format" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"blurb" text NOT NULL,
	"spec" text NOT NULL,
	"brief" text NOT NULL DEFAULT '',
	"source" text NOT NULL DEFAULT 'ai',
	"created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_drafts_created_at_idx ON product_drafts (created_at DESC);
