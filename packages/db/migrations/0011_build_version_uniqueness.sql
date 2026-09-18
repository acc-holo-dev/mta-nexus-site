DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "builds"
    GROUP BY "product_id", "version"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce build version uniqueness: duplicate versions exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "builds_product_version_idx"
  ON "builds" ("product_id", "version");
CREATE INDEX IF NOT EXISTS "builds_product_status_idx"
  ON "builds" ("product_id", "status");
