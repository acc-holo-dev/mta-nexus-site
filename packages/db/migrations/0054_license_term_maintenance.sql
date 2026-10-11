CREATE TABLE license_term_events (
  license_id text NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('expiring','expired')),
  expires_at timestamptz NOT NULL,
  notified boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (license_id, event, expires_at)
);
--> statement-breakpoint
CREATE INDEX licenses_finite_term_due_idx ON licenses(expires_at, id)
  WHERE expires_at IS NOT NULL AND status IN ('active','suspended','expired');
--> statement-breakpoint
CREATE FUNCTION nexus_license_term_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent licenses%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM licenses WHERE id = OLD.license_id) THEN
      RAISE EXCEPTION 'Processed license term events are retained' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Processed license term events are immutable' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO parent FROM licenses WHERE id = NEW.license_id FOR NO KEY UPDATE;
  IF parent.id IS NULL OR NOT isfinite(NEW.expires_at) OR parent.expires_at IS DISTINCT FROM NEW.expires_at
    OR (NEW.event = 'expired' AND (parent.status <> 'expired' OR NEW.expires_at > clock_timestamp()))
    OR (NEW.event = 'expiring' AND (parent.status <> 'active' OR NEW.expires_at <= clock_timestamp()
      OR NEW.expires_at > clock_timestamp() + interval '3 days')) THEN
    RAISE EXCEPTION 'License event must match the current finite term' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER license_term_events_guard BEFORE INSERT OR UPDATE OR DELETE ON license_term_events
  FOR EACH ROW EXECUTE FUNCTION nexus_license_term_event_guard();
