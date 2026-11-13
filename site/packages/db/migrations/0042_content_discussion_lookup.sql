-- Agent B's published-discussion keyset contract: content/time/id, no product reviews.
CREATE INDEX "comments_content_created_id_idx" ON "comments"
  ("content_id", "created_at" DESC, "id" DESC)
  WHERE "product_id" IS NULL AND "content_id" IS NOT NULL;
