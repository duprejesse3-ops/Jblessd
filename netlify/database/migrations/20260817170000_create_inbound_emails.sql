CREATE TABLE IF NOT EXISTS inbound_emails (
  id SERIAL PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  text_body TEXT,
  html_body TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  received_at TIMESTAMPTZ DEFAULT now()
);
