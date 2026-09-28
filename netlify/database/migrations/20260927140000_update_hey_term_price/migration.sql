-- Drops Hey Term (AI-AG-130) from $69 to $29 -- unproven product, don't
-- want to price it greedily out of the gate. Roll-forward, idempotent.
UPDATE products SET price = 29 WHERE sku = 'AI-AG-130' AND price <> 29;
