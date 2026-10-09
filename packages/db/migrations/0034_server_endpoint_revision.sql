-- Preserve existing server identity while invalidating proofs on endpoint edits.
-- NULL challenge revisions denote pre-migration evidence and fail closed.
ALTER TABLE "servers" ADD COLUMN "endpoint_revision" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "server_claim_challenges" ADD COLUMN "endpoint_revision" integer;
--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_endpoint_revision_nonnegative"
  CHECK ("endpoint_revision" >= 0);
--> statement-breakpoint
ALTER TABLE "server_claim_challenges"
  ADD CONSTRAINT "server_claim_endpoint_revision_nonnegative"
  CHECK ("endpoint_revision" IS NULL OR "endpoint_revision" >= 0);
