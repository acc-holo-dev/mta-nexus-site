-- Additive: existing notification rows and clients retain their plain-text fallback.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data jsonb;
