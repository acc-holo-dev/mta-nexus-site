CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "follows_enabled" boolean NOT NULL DEFAULT true,
  "content_enabled" boolean NOT NULL DEFAULT true,
  "server_enabled" boolean NOT NULL DEFAULT true,
  "commerce_enabled" boolean NOT NULL DEFAULT true,
  "system_enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_idx"
  ON "notification_preferences" ("user_id");
