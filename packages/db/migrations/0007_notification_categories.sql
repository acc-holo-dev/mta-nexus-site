ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'system';
