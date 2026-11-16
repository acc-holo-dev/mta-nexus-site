-- New notification writes persist optional admission intent in the inbox transaction.
-- No historical inbox backfill or discussion receipt changes.
CREATE TABLE "web_push_admission_recovery" (
  "notification_id" text PRIMARY KEY REFERENCES "notifications" ("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL,
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "attempts" integer NOT NULL DEFAULT 0,
  CONSTRAINT "web_push_admission_recovery_attempts_bounds" CHECK ("attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE INDEX "web_push_admission_recovery_due_idx"
  ON "web_push_admission_recovery" ("available_at", "notification_id")
  WHERE "attempts" < 5;
--> statement-breakpoint
CREATE INDEX "web_push_admission_recovery_created_idx"
  ON "web_push_admission_recovery" ("created_at", "notification_id");
