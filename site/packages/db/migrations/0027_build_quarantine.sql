ALTER TABLE builds
  ADD COLUMN quarantine_previous_status text,
  ADD COLUMN quarantine_reason text,
  ADD COLUMN quarantined_at timestamp with time zone,
  ADD COLUMN quarantined_by text;
--> statement-breakpoint
ALTER TABLE builds
  ADD CONSTRAINT builds_quarantined_by_users_id_fk
  FOREIGN KEY (quarantined_by) REFERENCES users(id)
  ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE builds
  ADD CONSTRAINT builds_quarantine_metadata_check
  CHECK (
    status <> 'quarantined'
    OR (
      quarantine_previous_status IN ('published', 'pending_review')
      AND quarantine_reason IS NOT NULL
      AND btrim(quarantine_reason) <> ''
      AND quarantined_at IS NOT NULL
    )
  );
