-- Normalize only the known historical alias. Unknown values must fail validation.
UPDATE products SET type = 'plugin', updated_at = now() WHERE type = 'tool';
ALTER TABLE products ADD CONSTRAINT products_type_check CHECK (
  type IN ('script', 'vehicle', 'model', 'map', 'ui', 'plugin', 'api', 'bundle', 'service')
);
