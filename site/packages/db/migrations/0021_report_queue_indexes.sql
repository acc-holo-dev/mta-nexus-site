CREATE INDEX IF NOT EXISTS "reports_status_created_id_idx"
  ON "reports" ("status", "created_at", "id");

CREATE INDEX IF NOT EXISTS "reports_status_resolved_id_idx"
  ON "reports" ("status", "resolved_at", "id");
