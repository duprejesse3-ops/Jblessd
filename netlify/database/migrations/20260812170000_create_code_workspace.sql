-- Backs the browser-based code workspace at /code, which is the site hosting its
-- own development environment: the owner writes an app's source in a browser (on
-- a phone, a tablet, a borrowed laptop) and the site serves it straight back at
-- /p/<slug>. No container, no local toolchain, no deploy in between.
--
-- Two tables rather than one blob of source per app, because the workspace lists,
-- sorts and opens apps individually and edits one file at a time. Content lives
-- in Postgres (not Netlify Blobs) because these are queryable records — the app
-- index is a real listing ordered by recency, and a save touches a single row.
--
--   code_apps   — one row per app. `slug` is the URL segment the app is served
--                 under (/p/<slug>): lowercase, hyphenated, unique across the
--                 site, and stable once created so a shared link keeps working
--                 after the app's title is renamed. `published` false means the
--                 app is served only to a caller holding the owner session, so
--                 work in progress is reachable from the owner's phone without
--                 being public — and is a plain 404 to everyone else rather than
--                 a 403, which would confirm it exists.
--   code_files  — one row per file in an app. `path` is relative within the app,
--                 e.g. "index.html" or "lib/util.js", and is validated against an
--                 allowlist in netlify/lib/code-workspace.mts before it can ever
--                 reach this column: no absolute paths, no "..", no unrecognised
--                 extension, at most one directory deep. The unique constraint on
--                 (app_id, path) is what lets a save be a single upsert.
--
-- Timestamps are `with time zone` to match every other table in this schema.
-- netlify/functions/code-serve.mts turns updated_at into a Last-Modified header,
-- which has to be an absolute instant; a naive timestamp would be read back
-- without an offset and dated wrongly.
CREATE TABLE IF NOT EXISTS "code_apps" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"published" boolean NOT NULL DEFAULT false,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- The workspace index is "my apps, most recently touched first".
CREATE INDEX IF NOT EXISTS code_apps_updated_at_idx ON code_apps ("updated_at" DESC);

CREATE TABLE IF NOT EXISTS "code_files" (
	"id" serial PRIMARY KEY,
	"app_id" integer NOT NULL REFERENCES code_apps ("id") ON DELETE CASCADE,
	"path" text NOT NULL,
	"content" text NOT NULL DEFAULT '',
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT code_files_app_path_key UNIQUE ("app_id", "path")
);

-- Serving /p/<slug>/<path> is a lookup on exactly this pair.
CREATE INDEX IF NOT EXISTS code_files_app_id_idx ON code_files ("app_id", "path");
