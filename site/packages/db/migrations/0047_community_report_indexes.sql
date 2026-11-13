CREATE INDEX "reports_reporter_created_id_idx" ON "reports" ("reporter_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "reports_reporter_pending_target_idx" ON "reports" ("reporter_id", "target_type", "target_id") WHERE "status" IN ('open', 'under_review');
