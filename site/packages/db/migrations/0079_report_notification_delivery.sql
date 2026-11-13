-- Source progress commits with each new report and its report.created audit.
-- Historical reports are intentionally not backfilled.
CREATE TABLE "report_notification_deliveries" (
  "report_id" text PRIMARY KEY REFERENCES "reports" ("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL,
  "community" boolean NOT NULL DEFAULT false,
  "last_recipient_id" text,
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "attempts" integer NOT NULL DEFAULT 0,
  "completed_at" timestamptz,
  CONSTRAINT "report_notification_deliveries_attempts_bounds" CHECK ("attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE INDEX "report_notification_deliveries_due_idx"
  ON "report_notification_deliveries" ("available_at", "report_id")
  WHERE "completed_at" IS NULL AND "attempts" < 5;
--> statement-breakpoint
CREATE INDEX "users_report_notification_recipient_idx" ON "users" ("id", "created_at")
  WHERE "role" IN ('moderator', 'admin');
