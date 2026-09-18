ALTER TABLE "servers"
  ADD COLUMN IF NOT EXISTS "website_url" text;

ALTER TABLE "servers"
  ADD COLUMN IF NOT EXISTS "discord_url" text;

ALTER TABLE "servers"
  ADD COLUMN IF NOT EXISTS "rules_url" text;

ALTER TABLE "servers"
  ADD COLUMN IF NOT EXISTS "media_urls" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "servers"
  ADD COLUMN IF NOT EXISTS "language" text;

ALTER TABLE "servers"
  ADD COLUMN IF NOT EXISTS "region" text;

ALTER TABLE "servers"
  ADD COLUMN IF NOT EXISTS "gameplay_tags" jsonb NOT NULL DEFAULT '[]'::jsonb;
