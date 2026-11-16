-- FLOW-06 A: quiet publication bookmark vs discussion follow on content follows.
-- Existing rows keep notify_comments = true (prior notice semantics unchanged).
ALTER TABLE "follows"
  ADD COLUMN "notify_comments" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
-- FLOW-05 A: object mute/snooze for a specific target; independent of unfollow/watch.
-- muted_until is always set for 24h/7d/30d snooze; unmute deletes the row.
-- Events during mute are not queued (no catch-up). Security/account notices ignore this table.
CREATE TABLE "object_notification_mutes" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "muted_until" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "object_notification_mutes_target_type_check"
    CHECK ("target_type" IN ('user', 'organization', 'server', 'product', 'content'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "object_notification_mutes_user_target_idx"
  ON "object_notification_mutes" ("user_id", "target_type", "target_id");
--> statement-breakpoint
CREATE INDEX "object_notification_mutes_active_lookup_idx"
  ON "object_notification_mutes" ("user_id", "target_type", "target_id", "muted_until");
