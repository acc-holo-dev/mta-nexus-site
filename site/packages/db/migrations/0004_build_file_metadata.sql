ALTER TABLE "builds"
  ADD COLUMN IF NOT EXISTS "file_name" text NOT NULL DEFAULT 'resource.zip',
  ADD COLUMN IF NOT EXISTS "mime_type" text NOT NULL DEFAULT 'application/octet-stream';
