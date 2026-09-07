-- Adds Closed Chair (AI-AG-111) to the catalog.
--
-- Office-hours agent bound to one course packet. Explicitly not a homework
-- machine: refuses definitions, final answers, and submission-ready prose,
-- and defers to the human professor whenever the packet doesn't cover it.
-- Distinct from AI-AG-049 (Study Buddy Tutor Agent) by design — that one is
-- open-subject Socratic tutoring; this one is closed-world, packet-only,
-- and treats a demoable refusal as the actual product.
--
-- Text-only for now. The source material also describes a $52 voice-bundle
-- price point (paired with a not-yet-built AI-CN-110 voice session product)
-- — left out here since the catalog has no base+addon pricing mechanism;
-- that would need its own SKU once/if the voice product exists.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-AG-111', 'Closed Chair', 'agents', 'students', 'Agent config + packet schema + eval clips', 36, 'Office hours that only know your syllabus. Load the packet or the chair stays empty — it won''t fetch the internet, invent a late policy, or finish the problem, and it sends you to the human professor when the packet is silent.', 'Packet-only knowledge · refuses finished answers · syllabus-verb exam prep')
ON CONFLICT (sku) DO NOTHING;
