-- Discovery is opt-in. Preserve every legacy object and commercial record.
CREATE TABLE storage_maintenance_objects (
 id text PRIMARY KEY CHECK (id ~ '^smo_[a-f0-9]{24}$'),
 storage_key text NOT NULL UNIQUE,
 identity jsonb NOT NULL,
 modified_at timestamptz NOT NULL CHECK (isfinite(modified_at)),
 state text NOT NULL DEFAULT 'observed' CHECK (state IN ('observed','retired','deleted','missing','changed','failed')),
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
 observed_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 retired_at timestamptz,
 lease_token text,
 lease_expires_at timestamptz,
 requested_by text REFERENCES users(id) ON DELETE SET NULL,
 result_code text CHECK (result_code IS NULL OR length(result_code) <= 80),
 CONSTRAINT storage_maintenance_identity_check CHECK (COALESCE(
   jsonb_typeof(identity) = 'object' AND octet_length(identity::text) <= 2048 AND
   storage_key ~ '^assets/[A-Za-z0-9_-]{1,128}/ast_[A-Za-z0-9_-]{1,100}\.(zip|rar|7z|lua|luac|dff|txd|col|png|jpg|jpeg|webp|json|map)$' AND
   jsonb_typeof(identity->'sizeBytes') = 'number' AND
   (identity->>'modifiedAt')::timestamptz = modified_at AND
   identity->>'key' = storage_key AND identity->>'sha256Hash' ~ '^[a-f0-9]{64}$' AND
   (identity->>'sizeBytes')::bigint BETWEEN 1 AND 67108864 AND
   identity->>'device' ~ '^[0-9]+$' AND identity->>'inode' ~ '^[0-9]+$' AND
   identity->>'mtimeNs' ~ '^-?[0-9]+$' AND identity->>'ctimeNs' ~ '^-?[0-9]+$', false)),
 CONSTRAINT storage_maintenance_retirement_check CHECK (
   COALESCE((state = 'observed' AND retired_at IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL) OR
   (state <> 'observed' AND retired_at IS NOT NULL AND isfinite(retired_at) AND
     ((lease_token IS NULL AND lease_expires_at IS NULL) OR
      (state = 'retired' AND lease_token ~ '^sml_[a-f0-9]{24}$' AND lease_expires_at IS NOT NULL AND isfinite(lease_expires_at)))), false)
 )
);
--> statement-breakpoint
CREATE INDEX storage_maintenance_state_modified_idx ON storage_maintenance_objects(state, modified_at, id);
CREATE INDEX builds_storage_key_idx ON builds(storage_key);
CREATE INDEX assets_storage_key_idx ON assets(storage_key);
--> statement-breakpoint
CREATE FUNCTION nexus_storage_tombstone_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.state <> 'observed' THEN
   RAISE EXCEPTION 'Storage objects must start as observations' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
 END IF;
 IF TG_OP = 'UPDATE' AND NEW.state <> OLD.state THEN
  IF NOT ((OLD.state = 'observed' AND NEW.state = 'retired') OR
          (OLD.state = 'retired' AND NEW.state IN ('deleted','missing','changed','failed')) OR
          (OLD.state = 'failed' AND NEW.state = 'retired')) OR NEW.revision <> OLD.revision + 1 THEN
   RAISE EXCEPTION 'Invalid storage maintenance transition' USING ERRCODE = '23514';
  END IF;
 END IF;
 IF TG_OP = 'UPDATE' AND OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL THEN
  IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN
   RAISE EXCEPTION 'Storage retirement requires a current snapshot' USING ERRCODE = '40001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('storage-retirement:' || OLD.storage_key,0));
  IF NEW.storage_key <> OLD.storage_key OR NEW.identity IS DISTINCT FROM OLD.identity OR NEW.modified_at <> OLD.modified_at OR
    OLD.modified_at > clock_timestamp() - interval '7 days' OR
    EXISTS (SELECT 1 FROM builds WHERE storage_key = OLD.storage_key) OR
    EXISTS (SELECT 1 FROM resource_media WHERE storage_key = OLD.storage_key) OR
    EXISTS (SELECT 1 FROM assets WHERE storage_key = OLD.storage_key) THEN
   RAISE EXCEPTION 'Storage object is not eligible for retirement' USING ERRCODE = '23514';
  END IF;
 END IF;
 IF OLD.retired_at IS NOT NULL THEN
  IF TG_OP = 'DELETE' THEN
   RAISE EXCEPTION 'Storage retirement barrier is permanent' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.id,NEW.storage_key,NEW.identity,NEW.modified_at,NEW.retired_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.storage_key,OLD.identity,OLD.modified_at,OLD.retired_at)
      OR NEW.state = 'observed' THEN
   RAISE EXCEPTION 'Retired storage identity is immutable' USING ERRCODE = '23514';
  END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER storage_tombstone_guard BEFORE INSERT OR UPDATE OR DELETE ON storage_maintenance_objects
 FOR EACH ROW EXECUTE FUNCTION nexus_storage_tombstone_guard();
--> statement-breakpoint
CREATE FUNCTION nexus_storage_reference_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.storage_key = OLD.storage_key THEN RETURN NEW; END IF;
 -- A snapshot established before discovery must never bypass a later tombstone.
 -- PostgreSQL treats READ UNCOMMITTED as READ COMMITTED. Existing writers use it.
 IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN
  RAISE EXCEPTION 'New storage references require a current snapshot' USING ERRCODE = '40001';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('storage-retirement:' || NEW.storage_key, 0));
 IF EXISTS (SELECT 1 FROM storage_maintenance_objects WHERE storage_key = NEW.storage_key AND retired_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Storage object was retired' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER builds_storage_reference_guard BEFORE INSERT OR UPDATE OF storage_key ON builds
 FOR EACH ROW EXECUTE FUNCTION nexus_storage_reference_guard();
CREATE TRIGGER media_storage_reference_guard BEFORE INSERT OR UPDATE OF storage_key ON resource_media
 FOR EACH ROW EXECUTE FUNCTION nexus_storage_reference_guard();
CREATE TRIGGER assets_storage_reference_guard BEFORE INSERT OR UPDATE OF storage_key ON assets
 FOR EACH ROW EXECUTE FUNCTION nexus_storage_reference_guard();
