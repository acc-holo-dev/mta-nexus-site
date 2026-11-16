-- Preserve historical publication states. Only future editorial changes set this flag.
ALTER TABLE products ADD COLUMN metadata_review_required boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE products ADD CONSTRAINT products_metadata_review_state_check CHECK (NOT metadata_review_required OR status <> 'published');
--> statement-breakpoint
CREATE FUNCTION nexus_product_metadata_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.title, NEW.short_description, NEW.description, NEW.tags, NEW.compatibility)
    IS DISTINCT FROM ROW(OLD.title, OLD.short_description, OLD.description, OLD.tags, OLD.compatibility) THEN
    IF OLD.status IN ('archived','suspended') THEN
      RAISE EXCEPTION 'Withdrawn resource metadata is read-only' USING ERRCODE = '23514';
    END IF;
    NEW.metadata_review_required := true;
    NEW.status := 'draft';
    NEW.is_featured := false;
    NEW.updated_at := greatest(date_trunc('milliseconds', clock_timestamp()),
      date_trunc('milliseconds', OLD.updated_at) + interval '1 millisecond');
  END IF;
  IF NEW.metadata_review_required AND NEW.status = 'published' THEN
    RAISE EXCEPTION 'Resource metadata requires a new review' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.status, NEW.current_version, NEW.is_featured, NEW.metadata_review_required)
    IS DISTINCT FROM ROW(OLD.status, OLD.current_version, OLD.is_featured, OLD.metadata_review_required) THEN
    -- State changes also invalidate publisher observations, while rating/counter
    -- repair alone keeps the existing metadata revision.
    NEW.updated_at := greatest(date_trunc('milliseconds', clock_timestamp()),
      date_trunc('milliseconds', OLD.updated_at) + interval '1 millisecond');
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER products_metadata_review BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION nexus_product_metadata_review();
--> statement-breakpoint
CREATE FUNCTION nexus_product_metadata_withdraw_pending() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.title, NEW.short_description, NEW.description, NEW.tags, NEW.compatibility)
    IS DISTINCT FROM ROW(OLD.title, OLD.short_description, OLD.description, OLD.tags, OLD.compatibility) THEN
    -- All review observations refer to the previous editorial context. Existing
    -- published artifacts and grants remain stored, but the parent is withdrawn.
    PERFORM id FROM builds WHERE product_id = NEW.id AND status = 'pending_review'
      ORDER BY id FOR UPDATE;
    UPDATE builds SET status = 'draft' WHERE product_id = NEW.id AND status = 'pending_review';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER products_metadata_withdraw_pending AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION nexus_product_metadata_withdraw_pending();
--> statement-breakpoint
CREATE INDEX products_managed_updated_id_idx ON products(updated_at DESC, id DESC) WHERE price = 0;
