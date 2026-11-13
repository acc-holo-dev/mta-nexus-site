-- Only new support mutations enqueue delivery; existing cases are not backfilled.
CREATE TABLE "support_notification_deliveries" (
  "message_id" text PRIMARY KEY REFERENCES "support_case_messages" ("id") ON DELETE CASCADE,
  "case_id" text NOT NULL REFERENCES "support_cases" ("id") ON DELETE CASCADE,
  "event" text NOT NULL CONSTRAINT "support_notification_deliveries_event_check" CHECK ("event" IN ('case_created', 'requester_reply')),
  "excluded_recipient_id" text,
  "created_at" timestamptz NOT NULL,
  "last_recipient_id" text,
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "attempts" integer NOT NULL DEFAULT 0,
  "completed_at" timestamptz,
  CONSTRAINT "support_notification_deliveries_attempts_bounds" CHECK ("attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE INDEX "support_notification_deliveries_due_idx"
  ON "support_notification_deliveries" ("available_at", "message_id")
  WHERE "completed_at" IS NULL AND "attempts" < 5;
