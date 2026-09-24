-- Prepaid credit system for the Claude Agent Studio (/agent).
--
-- The store's only revenue line so far is one-off digital product sales. This
-- adds a second, recurring one: customers buy a balance of credits and spend it
-- running a real Claude agent on their own work. Every table here exists to make
-- that balance trustworthy — money in, credits out, and an auditable trail
-- between the two.
--
--   credit_accounts  — one row per customer, keyed by email. `balance` is the
--                      authoritative spendable amount; it is only ever moved
--                      inside a transaction that also writes a credit_ledger
--                      row, so the ledger always explains the balance.
--                      Access is proven by a bearer access key that is shown to
--                      the customer once and never stored in plaintext: only
--                      key_hash (SHA-256 of the key) is kept, so a database
--                      leak cannot be replayed against the API. Re-issuing a
--                      key replaces the hash, which retires the previous key.
--   credit_ledger    — append-only history of every credit movement: purchases
--                      (positive), agent runs (negative), refunds of failed
--                      runs, and grants. `stripe_session_id` is uniquely indexed
--                      so a Stripe webhook retry and the browser's own claim
--                      call can both race to grant the same purchase and it is
--                      still granted exactly once.
--   agent_runs       — one row per metered agent run, with the model, the credit
--                      price charged and the real token usage. This is the
--                      margin ledger: it is what tells the owner whether a
--                      credit is priced above what the run actually costs.
--   agent_artifacts  — the finished deliverables the agent saved for a customer,
--                      so a paid run produces something durable they can come
--                      back for rather than a chat message that scrolls away.
--
-- No card data or Stripe customer PII is stored here — only the buyer's email
-- (the account key) and the session id needed for idempotency.

CREATE TABLE IF NOT EXISTS "credit_accounts" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL,
	"key_hash" text NOT NULL,
	"balance" integer NOT NULL DEFAULT 0,
	"lifetime_credits" integer NOT NULL DEFAULT 0,
	"lifetime_spend_cents" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	"last_seen_at" timestamp with time zone,
	CONSTRAINT credit_accounts_balance_non_negative CHECK ("balance" >= 0)
);

-- One account per email address (stored lowercased by the application), and key
-- lookups on every authenticated request must hit an index.
CREATE UNIQUE INDEX IF NOT EXISTS credit_accounts_email_idx ON credit_accounts (lower("email"));
CREATE UNIQUE INDEX IF NOT EXISTS credit_accounts_key_hash_idx ON credit_accounts ("key_hash");

CREATE TABLE IF NOT EXISTS "credit_ledger" (
	"id" bigserial PRIMARY KEY,
	"account_id" integer NOT NULL REFERENCES credit_accounts ("id") ON DELETE CASCADE,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"balance_after" integer,
	"stripe_session_id" text,
	"amount_cents" integer,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_ledger_account_idx ON credit_ledger ("account_id", "created_at" DESC);
-- Grant a given Stripe purchase exactly once, however many times it is reported.
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_session_idx
	ON credit_ledger ("stripe_session_id") WHERE "stripe_session_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" bigserial PRIMARY KEY,
	"account_id" integer REFERENCES credit_accounts ("id") ON DELETE SET NULL,
	"mode" text NOT NULL,
	"model" text NOT NULL,
	"credits" integer NOT NULL DEFAULT 0,
	"input_tokens" integer NOT NULL DEFAULT 0,
	"output_tokens" integer NOT NULL DEFAULT 0,
	"steps" integer NOT NULL DEFAULT 1,
	"brief" text,
	"status" text NOT NULL DEFAULT 'ok',
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_runs_created_idx ON agent_runs ("created_at" DESC);
CREATE INDEX IF NOT EXISTS agent_runs_account_idx ON agent_runs ("account_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "agent_artifacts" (
	"id" bigserial PRIMARY KEY,
	"account_id" integer NOT NULL REFERENCES credit_accounts ("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"kind" text NOT NULL DEFAULT 'document',
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_artifacts_account_idx ON agent_artifacts ("account_id", "created_at" DESC);
