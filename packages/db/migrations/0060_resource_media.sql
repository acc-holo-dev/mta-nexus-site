-- Earlier external preview URLs remain unchanged until the publisher edits the gallery.
CREATE TABLE resource_media (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  sha256_hash text NOT NULL,
  file_size_bytes integer NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  scanner text NOT NULL,
  scanned_at timestamptz NOT NULL,
  caption text NOT NULL DEFAULT '',
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_media_identity_check CHECK (
    id ~ '^rmi_[A-Za-z0-9_-]{1,100}$' AND
    storage_key ~ '^assets/[A-Za-z0-9_-]{1,128}/ast_[A-Za-z0-9_-]+\.png$' AND
    sha256_hash ~ '^[a-f0-9]{64}$' AND file_size_bytes BETWEEN 1 AND 4194304 AND
    width BETWEEN 1 AND 1920 AND height BETWEEN 1 AND 1920 AND
    length(btrim(scanner)) BETWEEN 1 AND 100 AND scanner <> 'disabled'),
  CONSTRAINT resource_media_caption_check CHECK (length(caption) <= 160),
  CONSTRAINT resource_media_position_check CHECK (position BETWEEN 0 AND 7),
  CONSTRAINT resource_media_product_position_unique UNIQUE (product_id, position) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT resource_media_product_hash_unique UNIQUE (product_id, sha256_hash)
);
--> statement-breakpoint
CREATE FUNCTION nexus_resource_media_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent products%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(NEW.id, NEW.product_id, NEW.storage_key, NEW.sha256_hash,
    NEW.file_size_bytes, NEW.width, NEW.height, NEW.scanner, NEW.scanned_at, NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id, OLD.product_id, OLD.storage_key, OLD.sha256_hash,
    OLD.file_size_bytes, OLD.width, OLD.height, OLD.scanner, OLD.scanned_at, OLD.created_at) THEN
    RAISE EXCEPTION 'Gallery artifact identity is immutable' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO parent FROM products WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END FOR NO KEY UPDATE;
  -- Product deletion cascades may remove media without recreating the parent.
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Missing gallery resource' USING ERRCODE = '23514';
  END IF;
  IF parent.status IN ('archived','suspended') OR parent.price <> 0 THEN
    RAISE EXCEPTION 'Gallery resource is read-only' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM resource_media WHERE product_id = NEW.product_id) >= 8 THEN
    RAISE EXCEPTION 'Gallery limit reached' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER resource_media_guard BEFORE INSERT OR UPDATE OR DELETE ON resource_media
  FOR EACH ROW EXECUTE FUNCTION nexus_resource_media_guard();
--> statement-breakpoint
CREATE FUNCTION nexus_resource_media_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE resource_id text; urls jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.caption = OLD.caption AND NEW.position = OLD.position THEN RETURN NULL; END IF;
  resource_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
  SELECT coalesce(jsonb_agg('/api/resource-media/' || id ORDER BY position, id), '[]'::jsonb)
    INTO urls FROM resource_media WHERE product_id = resource_id;
  UPDATE products SET thumbnail_url = urls->>0, screenshots = urls,
    metadata_review_required = true, status = 'draft', is_featured = false,
    updated_at = greatest(date_trunc('milliseconds', clock_timestamp()),
      date_trunc('milliseconds', updated_at) + interval '1 millisecond') WHERE id = resource_id;
  PERFORM id FROM builds WHERE product_id = resource_id AND status = 'pending_review' ORDER BY id FOR UPDATE;
  UPDATE builds SET status = 'draft' WHERE product_id = resource_id AND status = 'pending_review';
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER resource_media_changed AFTER INSERT OR UPDATE OR DELETE ON resource_media
  FOR EACH ROW EXECUTE FUNCTION nexus_resource_media_changed();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION nexus_product_metadata_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.title, NEW.short_description, NEW.description, NEW.tags, NEW.compatibility, NEW.thumbnail_url, NEW.screenshots)
    IS DISTINCT FROM ROW(OLD.title, OLD.short_description, OLD.description, OLD.tags, OLD.compatibility, OLD.thumbnail_url, OLD.screenshots) THEN
    IF OLD.status IN ('archived','suspended') THEN
      RAISE EXCEPTION 'Withdrawn resource metadata is read-only' USING ERRCODE = '23514';
    END IF;
    NEW.metadata_review_required := true; NEW.status := 'draft'; NEW.is_featured := false;
    NEW.updated_at := greatest(date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', OLD.updated_at) + interval '1 millisecond');
  END IF;
  IF NEW.metadata_review_required AND NEW.status = 'published' THEN
    RAISE EXCEPTION 'Resource metadata requires a new review' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.status, NEW.current_version, NEW.is_featured, NEW.metadata_review_required)
    IS DISTINCT FROM ROW(OLD.status, OLD.current_version, OLD.is_featured, OLD.metadata_review_required) THEN
    NEW.updated_at := greatest(date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', OLD.updated_at) + interval '1 millisecond');
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION nexus_product_metadata_withdraw_pending() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.title, NEW.short_description, NEW.description, NEW.tags, NEW.compatibility, NEW.thumbnail_url, NEW.screenshots)
    IS DISTINCT FROM ROW(OLD.title, OLD.short_description, OLD.description, OLD.tags, OLD.compatibility, OLD.thumbnail_url, OLD.screenshots) THEN
    PERFORM id FROM builds WHERE product_id = NEW.id AND status = 'pending_review' ORDER BY id FOR UPDATE;
    UPDATE builds SET status = 'draft' WHERE product_id = NEW.id AND status = 'pending_review';
  END IF;
  RETURN NEW;
END $$;
