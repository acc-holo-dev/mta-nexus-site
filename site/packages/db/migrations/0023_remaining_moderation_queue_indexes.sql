CREATE INDEX IF NOT EXISTS "builds_status_created_id_idx"
  ON "builds" ("status", "created_at", "id");

CREATE INDEX IF NOT EXISTS "content_status_created_id_idx"
  ON "content" ("status", "created_at", "id");
