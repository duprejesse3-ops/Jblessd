CREATE TABLE IF NOT EXISTS custom_orders (
  id TEXT PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  email TEXT,
  category TEXT NOT NULL,
  need_description TEXT NOT NULL,
  output TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generating','delivered','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);
