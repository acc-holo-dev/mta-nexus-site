CREATE TABLE "account_recovery_abuse_limits" (
  "scope" text NOT NULL,
  "subject_digest" text NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "account_recovery_abuse_limits_pk" PRIMARY KEY("scope","subject_digest"),
  CONSTRAINT "account_recovery_abuse_scope_check" CHECK ("scope" in ('email_verify_request','password_reset_request')),
  CONSTRAINT "account_recovery_abuse_digest_check" CHECK ("subject_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "account_recovery_abuse_count_check" CHECK ("count" between 0 and 1000),
  CONSTRAINT "account_recovery_abuse_window_check" CHECK ("expires_at" > "window_started_at")
);
--> statement-breakpoint
CREATE INDEX "account_recovery_abuse_expiry_idx" ON "account_recovery_abuse_limits" USING btree ("expires_at");
