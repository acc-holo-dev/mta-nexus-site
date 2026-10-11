ALTER TABLE builds ADD COLUMN revision integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE builds ADD CONSTRAINT builds_revision_check CHECK (revision > 0);
--> statement-breakpoint
-- Revisions cover legacy moderation, quarantine and retirement writers too.
-- An uploaded artifact/version is immutable; a new archive requires a new version.
CREATE FUNCTION nexus_build_workspace_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id, NEW.product_id, NEW.version, NEW.storage_key,
      NEW.file_name, NEW.mime_type, NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id, OLD.product_id, OLD.version, OLD.storage_key,
      OLD.file_name, OLD.mime_type, OLD.created_at) THEN
    RAISE EXCEPTION 'Uploaded build identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.sha256_hash, NEW.file_size_bytes) IS DISTINCT FROM ROW(OLD.sha256_hash, OLD.file_size_bytes)
    AND NOT coalesce((
      -- Preserve the existing explicit db:seed:repair path for these two
      -- development fixtures only; uploads cannot use these fixed identities.
      (ROW(OLD.id, OLD.product_id, OLD.version, OLD.storage_key) =
        ROW('bld_inv_320', 'prd_inv_pro', '3.2.0', 'builds/prd_inv_pro/v3.2.0.zip')
       OR ROW(OLD.id, OLD.product_id, OLD.version, OLD.storage_key) =
        ROW('bld_drift_214', 'prd_drift_physics', '2.1.4', 'builds/prd_drift_physics/v2.1.4.zip'))
      AND OLD.scanner = 'seed-manual-review' AND NEW.scanner = OLD.scanner
      AND OLD.scan_status = 'clean' AND NEW.scan_status = 'clean'
      AND NEW.status = OLD.status
    ), false) THEN
    RAISE EXCEPTION 'Uploaded build identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.release_notes, NEW.mta_version_target)
    IS DISTINCT FROM ROW(OLD.release_notes, OLD.mta_version_target)
    AND NOT (OLD.status IN ('draft', 'rejected') AND NEW.status = 'draft') THEN
    RAISE EXCEPTION 'Build metadata requires an editable draft' USING ERRCODE = '23514';
  END IF;
  IF (to_jsonb(NEW) - 'revision') IS DISTINCT FROM (to_jsonb(OLD) - 'revision') THEN
    IF OLD.revision = 2147483647 THEN
      RAISE EXCEPTION 'Build revision exhausted' USING ERRCODE = '23514';
    END IF;
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := OLD.revision;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER builds_workspace_revision BEFORE UPDATE ON builds
  FOR EACH ROW EXECUTE FUNCTION nexus_build_workspace_revision();
--> statement-breakpoint
-- Shared schema contract requested by Agent B. Missing rows retain public visibility.
CREATE TABLE user_profile_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  show_activity boolean NOT NULL DEFAULT true,
  show_professional_contacts boolean NOT NULL DEFAULT true
);
