-- Adds MultiCascade (AI-AG-112) to the catalog.
--
-- A root prompt that decomposes a stated goal into a structured cascade of
-- roles (architect, builders, critic, scribe), sized to the goal's actual
-- complexity rather than a fixed cast. Its one demoable discipline: the
-- critic role must name a real weakness or explicitly state it found none
-- and why — it cannot silently rubber-stamp the work. Explicitly honest
-- about what it is: one model working through a structured sequence of
-- roles in one context, never presented as literal separate AI agents or
-- a "team" — see SKU_RUN_BRIEF in product-app.mts for the enforced rule.
--
-- Multi-branded (category stays 'agents', not 'connectors') — same
-- precedent as MultiAgents (AI-AG-066): isSoftwareProduct() in
-- Product-image.mts matches on category OR a Multi[A-Z] name, so this
-- picks up the flagship gradient/icon card treatment regardless of category.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-AG-112', 'MultiCascade', 'agents', 'founders', 'System prompt + role cascade template', 42, 'Give it a goal and it runs your idea through a structured cascade — an architect scopes it, builders execute the pieces, and a critic has to name a real flaw before it ships, or say plainly why it found none. One model working through honest, visible passes — not a dashboard of fake teammates.', 'Root defines scope, not headcount · every role''s output shown, not merged · critic cannot rubber-stamp')
ON CONFLICT (sku) DO NOTHING;
