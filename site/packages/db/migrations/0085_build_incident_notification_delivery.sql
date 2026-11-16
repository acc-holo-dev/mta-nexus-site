-- SEC-002: durable fanout to users with a served delivery receipt for a quarantined build.
-- Jobs are created only when moderators explicitly request affected-downloader notice.
-- Historical receipts are never scanned without such a job; no backfill.
CREATE TABLE "build_incident_notification_deliveries" (
  "build_id" text PRIMARY KEY REFERENCES "builds" ("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products" ("id") ON DELETE CASCADE,
  "version" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "last_recipient_id" text,
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "attempts" integer NOT NULL DEFAULT 0,
  "completed_at" timestamptz,
  CONSTRAINT "build_incident_notification_deliveries_attempts_bounds"
    CHECK ("attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE INDEX "build_incident_notification_deliveries_due_idx"
  ON "build_incident_notification_deliveries" ("available_at", "build_id")
  WHERE "completed_at" IS NULL AND "attempts" < 5;
--> statement-breakpoint
CREATE INDEX "resource_delivery_build_served_user_idx"
  ON "resource_delivery_receipts" ("build_id", "user_id")
  WHERE "status" = 'served';
