-- Only new verification requests enqueue delivery; existing requests are not backfilled.
CREATE TABLE "verification_notification_deliveries" (
  "verification_request_id" text PRIMARY KEY REFERENCES "verification_requests" ("id") ON DELETE CASCADE,
  "event" text NOT NULL CONSTRAINT "verification_notification_deliveries_event_check" CHECK ("event" IN ('application', 'server_claim')),
  "created_at" timestamptz NOT NULL,
  "last_recipient_id" text,
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "attempts" integer NOT NULL DEFAULT 0,
  "completed_at" timestamptz,
  CONSTRAINT "verification_notification_deliveries_attempts_bounds" CHECK ("attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE INDEX "verification_notification_deliveries_due_idx"
  ON "verification_notification_deliveries" ("available_at", "verification_request_id")
  WHERE "completed_at" IS NULL AND "attempts" < 5;
