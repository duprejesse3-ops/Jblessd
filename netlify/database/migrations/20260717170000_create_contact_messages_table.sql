-- Durable, queryable home for the storefront's "Contact us" submissions.
--
-- The contact form is handled by Netlify Forms, which stores every submission
-- and can email the site owner (reply-to set to the sender). This table adds a
-- code-owned copy so contact messages are also available programmatically —
-- the same philosophy the free-pack lead magnet already follows (see
-- create_subscribers_table): give the data a durable, queryable home rather
-- than depending solely on the Netlify Forms UI or a manually-configured email
-- notification. The `submission-created` function trigger writes rows here on
-- every verified submission.
CREATE TABLE IF NOT EXISTS "contact_messages" (
	"id" bigserial PRIMARY KEY,
	"name" text NOT NULL DEFAULT '',
	"email" text NOT NULL,
	"message" text NOT NULL,
	"subject" text,
	"source" text NOT NULL DEFAULT 'contact-form',
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
	ON contact_messages (created_at DESC);
