CREATE TABLE "products" (
	"id" serial PRIMARY KEY,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"niche" text NOT NULL,
	"format" text NOT NULL,
	"price" numeric(10,2) NOT NULL,
	"blurb" text NOT NULL,
	"spec" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
