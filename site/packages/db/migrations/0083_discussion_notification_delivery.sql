-- Only new discussion comments enqueue delivery; existing comments are not backfilled.
CREATE TABLE "discussion_notification_deliveries" (
  "comment_id" text PRIMARY KEY REFERENCES "comments" ("id") ON DELETE CASCADE,
  "content_id" text NOT NULL REFERENCES "content" ("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL,
  "direct_completed" boolean NOT NULL DEFAULT false,
  "last_follower_created_at" timestamptz,
  "last_follower_id" text,
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "attempts" integer NOT NULL DEFAULT 0,
  "completed_at" timestamptz,
  CONSTRAINT "discussion_notification_deliveries_attempts_bounds" CHECK ("attempts" BETWEEN 0 AND 5),
  CONSTRAINT "discussion_notification_deliveries_follower_cursor_pair" CHECK (
    ("last_follower_created_at" IS NULL AND "last_follower_id" IS NULL)
    OR ("last_follower_created_at" IS NOT NULL AND "last_follower_id" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE INDEX "discussion_notification_deliveries_due_idx"
  ON "discussion_notification_deliveries" ("available_at", "comment_id")
  WHERE "completed_at" IS NULL AND "attempts" < 5;
