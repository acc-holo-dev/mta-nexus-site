ALTER TABLE "builds"
  ADD COLUMN IF NOT EXISTS "scan_status" text NOT NULL DEFAULT 'not_scanned',
  ADD COLUMN IF NOT EXISTS "scanner" text,
  ADD COLUMN IF NOT EXISTS "scanned_at" timestamp with time zone;
