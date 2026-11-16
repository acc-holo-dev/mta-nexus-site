CREATE TABLE "server_claim_challenges" (
  "id" text PRIMARY KEY NOT NULL,
  "server_id" text NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
  "requester_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_digest" text NOT NULL,
  "proof_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "source_fetched_at" timestamp with time zone,
  "verification_request_id" text,
  CONSTRAINT "server_claim_challenge_id_check" CHECK ("id" ~ '^scc_[0-9a-f-]{36}$'),
  CONSTRAINT "server_claim_challenge_digest_check" CHECK ("token_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "server_claim_challenge_version_check" CHECK ("proof_version" = 1),
  CONSTRAINT "server_claim_challenge_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "server_claim_challenge_terminal_check" CHECK (NOT ("consumed_at" IS NOT NULL AND "revoked_at" IS NOT NULL)),
  CONSTRAINT "server_claim_challenge_evidence_check" CHECK (
    ("consumed_at" IS NULL AND "source_fetched_at" IS NULL AND "verification_request_id" IS NULL)
    OR
    ("consumed_at" IS NOT NULL AND "source_fetched_at" IS NOT NULL AND "verification_request_id" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "server_claim_challenge_digest_unique" ON "server_claim_challenges" ("token_digest");
--> statement-breakpoint
CREATE UNIQUE INDEX "server_claim_challenge_active_requester_unique"
  ON "server_claim_challenges" ("server_id","requester_id")
  WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "server_claim_challenge_verification_unique"
  ON "server_claim_challenges" ("verification_request_id");
--> statement-breakpoint
CREATE INDEX "server_claim_challenge_server_idx"
  ON "server_claim_challenges" ("server_id","created_at");
--> statement-breakpoint
CREATE INDEX "server_claim_challenge_expiry_idx"
  ON "server_claim_challenges" ("expires_at");
