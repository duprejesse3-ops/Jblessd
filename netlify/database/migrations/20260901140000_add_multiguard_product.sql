-- Adds MultiGuard (AI-CN-007) to the catalog.
--
-- Filed under the existing 'connectors' category, same reasoning as
-- MultiWitness (AI-CN-006): it's the control layer that sits above the
-- other MultiConnect products, and reuses the same downloadable-app,
-- one-time-license pattern.
--
-- Priced between the Sheets/Airtable connector and Email/CRM — a control
-- plane over multiple connectors is more valuable than a single-service
-- integration, but it's simpler to build than the SMTP/approval-queue work
-- in Email/CRM.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-CN-007', 'MultiGuard', 'connectors', 'founders', 'Downloadable app · one-time license', 59, 'One dashboard for every MultiConnect tool you run, and one button to switch them all to read-only at once — instead of checking five separate dashboards during an incident.', 'Zero deps · works with any connector, not just ours · offline-safe by design')
ON CONFLICT (sku) DO NOTHING;
