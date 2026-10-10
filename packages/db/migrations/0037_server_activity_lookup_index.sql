-- Additive target timeline index. Normal transactional migration; schedule a maintenance window.
CREATE INDEX "audit_events_target_created_id_idx"
  ON "audit_events" ("target_type", "target_id", "created_at" DESC, "id" DESC);
