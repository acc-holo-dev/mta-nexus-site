-- Only future successful approvals create events. Existing publication is not
-- backfilled, and a new enrollment starts after the current committed events.
CREATE TABLE resource_release_events (
  sequence bigserial PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  build_id text NOT NULL UNIQUE REFERENCES builds(id) ON DELETE CASCADE,
  version text NOT NULL,
  sha256_hash text NOT NULL CHECK (sha256_hash ~ '^[a-f0-9]{64}$'),
  file_size_bytes integer NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 67108864),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX resource_release_product_sequence_idx ON resource_release_events(product_id, sequence);
--> statement-breakpoint
CREATE TABLE resource_release_watches (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  last_sequence bigint NOT NULL CHECK (last_sequence >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
--> statement-breakpoint
CREATE INDEX resource_release_watch_user_time_idx ON resource_release_watches(user_id, updated_at DESC, product_id);
--> statement-breakpoint
CREATE INDEX resource_release_watch_pending_idx ON resource_release_watches(product_id, last_sequence, user_id) WHERE enabled;
--> statement-breakpoint
CREATE FUNCTION nexus_resource_release_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE resource products%ROWTYPE; artifact builds%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Publication events are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM products WHERE id = OLD.product_id) AND EXISTS (SELECT 1 FROM builds WHERE id = OLD.build_id) THEN
      RAISE EXCEPTION 'Publication evidence can only be removed with its resource or build' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  SELECT * INTO resource FROM products WHERE id = NEW.product_id FOR SHARE;
  SELECT * INTO artifact FROM builds WHERE id = NEW.build_id FOR SHARE;
  IF resource.id IS NULL OR resource.status <> 'published' OR resource.metadata_review_required
    OR artifact.id IS NULL OR artifact.product_id <> NEW.product_id OR artifact.status <> 'published'
    OR artifact.scan_status <> 'clean' OR artifact.scanner IS NULL OR btrim(artifact.scanner) = '' OR artifact.scanned_at IS NULL
    OR (artifact.version, artifact.sha256_hash, artifact.file_size_bytes) IS DISTINCT FROM (NEW.version, NEW.sha256_hash, NEW.file_size_bytes) THEN
    RAISE EXCEPTION 'Release evidence requires a currently safe published build' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER resource_release_events_guard BEFORE INSERT OR UPDATE OR DELETE ON resource_release_events
  FOR EACH ROW EXECUTE FUNCTION nexus_resource_release_event_guard();
--> statement-breakpoint
CREATE FUNCTION nexus_resource_release_watch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.user_id, NEW.product_id) IS DISTINCT FROM (OLD.user_id, OLD.product_id)
    OR NEW.last_sequence < OLD.last_sequence OR NEW.revision < OLD.revision
    OR (NEW.enabled IS DISTINCT FROM OLD.enabled AND NEW.revision <> OLD.revision + 1) THEN
    RAISE EXCEPTION 'Release watch identity and progress cannot regress' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER resource_release_watches_guard BEFORE UPDATE ON resource_release_watches
  FOR EACH ROW EXECUTE FUNCTION nexus_resource_release_watch_guard();
