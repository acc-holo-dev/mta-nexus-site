-- Unknown historical ownership is retained as unknown. Owners must explicitly
-- reconfirm the same server with its current verified control proof.
ALTER TABLE license_runtime_bindings ADD COLUMN server_owner_id text;
--> statement-breakpoint
CREATE FUNCTION nexus_license_binding_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent licenses%ROWTYPE;
  target servers%ROWTYPE;
  context_changed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM licenses WHERE id = OLD.license_id) THEN
      RAISE EXCEPTION 'A saved binding cannot be removed while its license exists' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.license_id, NEW.server_id, NEW.organization_id, NEW.created_at)
      IS DISTINCT FROM ROW(OLD.license_id, OLD.server_id, OLD.organization_id, OLD.created_at)
      OR NEW.endpoint_revision < OLD.endpoint_revision
      OR (OLD.server_owner_id IS NOT NULL AND NEW.server_owner_id IS DISTINCT FROM OLD.server_owner_id) THEN
      RAISE EXCEPTION 'A license binding cannot change server or ownership scope' USING ERRCODE = '23514';
    END IF;
    context_changed := NEW.endpoint_revision IS DISTINCT FROM OLD.endpoint_revision
      OR NEW.server_owner_id IS DISTINCT FROM OLD.server_owner_id;
  ELSE context_changed := true; END IF;
  SELECT * INTO parent FROM licenses WHERE id = NEW.license_id;
  IF parent.id IS NULL THEN RAISE EXCEPTION 'License is missing' USING ERRCODE = '23514'; END IF;
  IF context_changed THEN
    SELECT * INTO target FROM servers WHERE id = NEW.server_id;
    IF NEW.token_digest IS NOT NULL OR target.id IS NULL OR NEW.server_owner_id IS NULL
      OR NEW.server_owner_id IS DISTINCT FROM target.owner_id
      OR NEW.organization_id IS DISTINCT FROM target.organization_id
      OR NEW.endpoint_revision IS DISTINCT FROM target.endpoint_revision
      OR target.status <> 'active' OR NOT target.is_verified
      OR parent.model <> 'single_server' OR parent.status <> 'active'
      OR parent.expires_at IS NULL OR parent.expires_at <= clock_timestamp()
      OR (parent.server_id IS NOT NULL AND parent.server_id <> NEW.server_id) THEN
      RAISE EXCEPTION 'Binding recovery needs the same server, current context and unchanged active term' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.token_digest IS NOT NULL AND (NEW.server_owner_id IS NULL
    OR parent.status <> 'active' OR parent.model <> 'single_server' OR parent.expires_at IS NULL
    OR parent.expires_at <= clock_timestamp()
    OR NEW.token_expires_at > parent.expires_at OR NEW.token_issued_at >= parent.expires_at) THEN
    RAISE EXCEPTION 'Runtime token must fit the recorded active license term' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER license_runtime_bindings_guard BEFORE INSERT OR UPDATE OR DELETE ON license_runtime_bindings
  FOR EACH ROW EXECUTE FUNCTION nexus_license_binding_guard();
--> statement-breakpoint
CREATE FUNCTION nexus_license_context_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE saved_server text;
BEGIN
  IF (OLD.status = 'revoked' AND NEW.status <> 'revoked')
    OR (OLD.status = 'expired' AND NEW.status NOT IN ('expired','revoked')) THEN
    RAISE EXCEPTION 'A final license cannot be reactivated without a new issuance' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT
    ((OLD.status = 'active' AND NEW.status IN ('suspended','expired','revoked'))
      OR (OLD.status = 'suspended' AND NEW.status IN ('active','expired','revoked'))
      OR (OLD.status = 'expired' AND NEW.status = 'revoked')) THEN
    RAISE EXCEPTION 'Invalid license state transition' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'suspended' AND NEW.status = 'active'
    AND (NEW.expires_at IS NULL OR NEW.expires_at <= clock_timestamp()) THEN
    RAISE EXCEPTION 'Restoration preserves a finite unexpired term' USING ERRCODE = '23514';
  END IF;
  SELECT server_id INTO saved_server FROM license_runtime_bindings WHERE license_id = OLD.id;
  IF saved_server IS NOT NULL THEN
    IF ROW(NEW.id, NEW.user_id, NEW.product_id, NEW.model, NEW.expires_at, NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id, OLD.user_id, OLD.product_id, OLD.model, OLD.expires_at, OLD.created_at)
      OR (NEW.server_id IS DISTINCT FROM saved_server AND NOT
        (NEW.server_id IS NULL AND NOT EXISTS (SELECT 1 FROM servers WHERE id = saved_server))) THEN
      RAISE EXCEPTION 'Bound license identity and original term are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at := greatest(date_trunc('milliseconds', clock_timestamp()),
      date_trunc('milliseconds', OLD.updated_at) + interval '1 millisecond');
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER licenses_context_guard BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION nexus_license_context_guard();
--> statement-breakpoint
CREATE FUNCTION nexus_license_clear_changed_tokens() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    UPDATE license_runtime_bindings SET token_digest = NULL, token_issued_at = NULL,
      token_expires_at = NULL, updated_at = clock_timestamp() WHERE license_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER licenses_clear_changed_tokens AFTER UPDATE OF status, expires_at ON licenses
  FOR EACH ROW EXECUTE FUNCTION nexus_license_clear_changed_tokens();
