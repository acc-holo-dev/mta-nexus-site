-- Only newly published server-linked content enqueues delivery; existing rows are not backfilled.
CREATE INDEX "follows_target_created_id_idx"
  ON "follows" ("target_type", "target_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE TABLE "publication_notification_deliveries" (
  "content_id" text PRIMARY KEY REFERENCES "content" ("id") ON DELETE CASCADE,
  "server_id" text NOT NULL REFERENCES "servers" ("id") ON DELETE CASCADE,
  "author_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL,
  "last_follower_created_at" timestamptz,
  "last_follower_id" text,
  "notified_count" integer NOT NULL DEFAULT 0,
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "attempts" integer NOT NULL DEFAULT 0,
  "completed_at" timestamptz,
  CONSTRAINT "publication_notification_deliveries_attempts_bounds" CHECK ("attempts" BETWEEN 0 AND 5),
  CONSTRAINT "publication_notification_deliveries_notified_bounds" CHECK ("notified_count" BETWEEN 0 AND 100),
  CONSTRAINT "publication_notification_deliveries_follower_cursor_pair" CHECK (
    ("last_follower_created_at" IS NULL AND "last_follower_id" IS NULL)
    OR ("last_follower_created_at" IS NOT NULL AND "last_follower_id" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE INDEX "publication_notification_deliveries_due_idx"
  ON "publication_notification_deliveries" ("available_at", "content_id")
  WHERE "completed_at" IS NULL AND "attempts" < 5;
