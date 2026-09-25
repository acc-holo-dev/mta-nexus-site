-- D2b: internal delivery state only. No worker, SMTP, or user-facing activation.
-- Existing pending ciphertext and proof/user data are preserved.
ALTER TABLE "account_mail_outbox"
  ADD COLUMN "attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN "available_at" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN "lease_token_digest" text,
  ADD COLUMN "lease_expires_at" timestamptz,
  ADD CONSTRAINT "account_mail_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5),
  ADD CONSTRAINT "account_mail_lease_check" CHECK (
    ("lease_token_digest" IS NULL AND "lease_expires_at" IS NULL)
    OR ("lease_token_digest" IS NOT NULL AND "lease_token_digest" ~ '^[0-9a-f]{64}$'
      AND "lease_expires_at" IS NOT NULL AND "attempts" > 0
      AND "lease_expires_at" <= "expires_at")
  );
--> statement-breakpoint
CREATE INDEX "account_mail_available_idx" ON "account_mail_outbox" ("available_at", "id");
