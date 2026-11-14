CREATE INDEX IF NOT EXISTS "verification_status_created_id_idx"
  ON "verification_requests" ("status", "created_at", "id");

CREATE INDEX IF NOT EXISTS "verification_status_resolved_id_idx"
  ON "verification_requests" ("status", "resolved_at", "id");
