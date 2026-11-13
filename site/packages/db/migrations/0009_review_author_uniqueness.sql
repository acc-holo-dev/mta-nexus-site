-- Enforce one product review per author without affecting article comments.
-- Existing duplicates are rejected explicitly rather than deleted.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "comments"
    WHERE "product_id" IS NOT NULL
    GROUP BY "product_id", "author_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one product review per author: duplicate reviews exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "comments_product_author_idx"
  ON "comments" ("product_id", "author_id");
