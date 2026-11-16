-- Start only inside live authorization. Historical start audits prove no bytes;
-- keep them untouched, without backfilling new receipts.
CREATE TABLE resource_delivery_receipts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id text NOT NULL,
  build_id text NOT NULL,
  version text NOT NULL,
  sha256_hash text NOT NULL,
  expected_bytes integer NOT NULL,
  pinned boolean NOT NULL,
  access_source text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  bytes_sent integer NOT NULL DEFAULT 0,
  error_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT resource_delivery_size_check CHECK (
    expected_bytes BETWEEN 1 AND 67108864 AND bytes_sent BETWEEN 0 AND expected_bytes
  ),
  CONSTRAINT resource_delivery_hash_check CHECK (sha256_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT resource_delivery_source_check CHECK (access_source IN ('manager','entitlement','license')),
  CONSTRAINT resource_delivery_state_check CHECK (
    (status = 'started' AND bytes_sent = 0 AND finished_at IS NULL AND error_code IS NULL) OR
    (status = 'served' AND bytes_sent = expected_bytes AND finished_at IS NOT NULL AND error_code IS NULL) OR
    (status = 'cancelled' AND finished_at IS NOT NULL AND error_code IS NULL) OR
    (status = 'failed' AND finished_at IS NOT NULL AND error_code IS NOT NULL AND error_code IN ('storage_error','size_mismatch','hash_mismatch'))
  ),
  CONSTRAINT resource_delivery_time_check CHECK (
    isfinite(started_at) AND (finished_at IS NULL OR (isfinite(finished_at) AND finished_at >= started_at))
  )
);
--> statement-breakpoint
-- IDs retain evidence after resource/build deletion; they never confer access.
CREATE FUNCTION nexus_resource_delivery_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
      RAISE EXCEPTION 'Delivery evidence can only be removed with its account' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'started' OR NEW.bytes_sent <> 0 OR NEW.finished_at IS NOT NULL OR NEW.error_code IS NOT NULL THEN
      RAISE EXCEPTION 'Delivery evidence must begin with live authorization' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.user_id, NEW.resource_id, NEW.build_id, NEW.version, NEW.sha256_hash,
      NEW.expected_bytes, NEW.pinned, NEW.access_source, NEW.started_at)
    IS DISTINCT FROM
     (OLD.id, OLD.user_id, OLD.resource_id, OLD.build_id, OLD.version, OLD.sha256_hash,
      OLD.expected_bytes, OLD.pinned, OLD.access_source, OLD.started_at) OR
     OLD.status <> 'started' OR NEW.status NOT IN ('served','cancelled','failed') THEN
    RAISE EXCEPTION 'Delivery identity and terminal evidence are immutable' USING ERRCODE = '23514';
  END IF;
  NEW.finished_at := greatest(clock_timestamp(), OLD.started_at);
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER resource_delivery_receipts_guard BEFORE INSERT OR UPDATE OR DELETE ON resource_delivery_receipts
  FOR EACH ROW EXECUTE FUNCTION nexus_resource_delivery_guard();
--> statement-breakpoint
CREATE INDEX resource_delivery_user_time_id_idx ON resource_delivery_receipts(user_id, started_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX resource_delivery_user_status_time_id_idx ON resource_delivery_receipts(user_id, status, started_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX resource_delivery_user_resource_time_id_idx ON resource_delivery_receipts(user_id, resource_id, started_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX resource_delivery_resource_time_id_idx ON resource_delivery_receipts(resource_id, started_at DESC, id DESC);
