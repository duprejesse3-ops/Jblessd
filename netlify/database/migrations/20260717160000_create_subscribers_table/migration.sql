-- Newsletter / free-prompt-pack signups. Backs the /api/free-pack endpoint,
-- which the storefront's "Get a free prompt pack" lead magnet posts to.
--
-- Previously the lead magnet was a plain Netlify Form: it recorded the email
-- but nothing was ever delivered to the person who signed up (Netlify Forms
-- only stores submissions / notifies the site owner), so subscribers never
-- received the pack they were promised. This table gives the signup a durable,
-- queryable home; delivery now happens in-response from the function.
--
-- Email is unique so re-submitting the same address is idempotent (ON CONFLICT
-- below just refreshes last_requested_at instead of creating duplicate rows).
CREATE TABLE IF NOT EXISTS "subscribers" (
	"id" bigserial PRIMARY KEY,
	"email" text NOT NULL,
	"source" text NOT NULL DEFAULT 'free-pack',
	"request_count" integer NOT NULL DEFAULT 1,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"last_requested_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_key
	ON subscribers (lower(email));
