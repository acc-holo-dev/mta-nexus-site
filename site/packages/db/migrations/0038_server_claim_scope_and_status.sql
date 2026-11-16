-- Legacy proof deliberately remains unbound and cannot approve a current server claim.
ALTER TABLE "server_claim_challenges" ADD COLUMN "claim_scope_recorded" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "server_claim_challenges" ADD COLUMN "claim_organization_id" text;
--> statement-breakpoint
ALTER TABLE "server_claim_challenges" ADD CONSTRAINT "server_claim_scope_recorded_check"
  CHECK ("claim_scope_recorded" OR "claim_organization_id" IS NULL);
--> statement-breakpoint
CREATE INDEX "verification_requests_target_created_id_idx"
  ON "verification_requests" ("target_type", "target_id", "created_at" DESC, "id" DESC);
