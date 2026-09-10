-- Move Meridian Host off Connectors onto its own Host Packs category.
UPDATE products
   SET category = 'host'
 WHERE sku = 'AI-HOST-001'
   AND category IS DISTINCT FROM 'host';
