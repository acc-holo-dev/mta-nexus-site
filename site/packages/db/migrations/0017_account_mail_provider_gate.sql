ALTER TABLE "account_mail_queue_gate"
  ADD COLUMN "provider_blocked_until" timestamptz;
--> statement-breakpoint
ALTER TABLE "account_mail_queue_gate"
  ADD COLUMN "provider_failure_streak" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "account_mail_queue_gate"
  ADD CONSTRAINT "account_mail_provider_failure_streak_bounds"
  CHECK ("provider_failure_streak" BETWEEN 0 AND 10);
--> statement-breakpoint
ALTER TABLE "account_mail_queue_gate"
  ADD CONSTRAINT "account_mail_provider_gate_state"
  CHECK (
    ("provider_blocked_until" IS NULL AND "provider_failure_streak" = 0)
    OR
    ("provider_blocked_until" IS NOT NULL AND "provider_failure_streak" BETWEEN 1 AND 10)
  );
