-- Collections contain private references, never entitlements or payment states.
CREATE TABLE library_collections (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL, status text NOT NULL DEFAULT 'active', revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_collections_id_user_unique UNIQUE(id,user_id),
  CONSTRAINT library_collections_name_check CHECK(length(name) BETWEEN 1 AND 80 AND name=btrim(name) AND name !~ '[[:cntrl:]]'),
  CONSTRAINT library_collections_state_check CHECK(status IN ('active','archived') AND revision>0),
  CONSTRAINT library_collections_time_check CHECK(isfinite(created_at) AND isfinite(updated_at) AND updated_at>=created_at)
);
--> statement-breakpoint
CREATE INDEX library_collections_user_status_time_idx ON library_collections(user_id,status,updated_at DESC,id);
--> statement-breakpoint
CREATE TABLE library_collection_items (
  collection_id text NOT NULL REFERENCES library_collections(id) ON DELETE CASCADE,
  product_id text NOT NULL CONSTRAINT library_collection_items_product_check CHECK(product_id ~ '^[A-Za-z0-9_-]{1,160}$'), added_at timestamptz NOT NULL DEFAULT now() CONSTRAINT library_collection_items_time_check CHECK(isfinite(added_at)),
  PRIMARY KEY(collection_id,product_id)
);
--> statement-breakpoint
CREATE INDEX library_collection_items_time_idx ON library_collection_items(collection_id,added_at DESC,product_id);
--> statement-breakpoint
CREATE TABLE library_collection_receipts (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL, collection_id text NOT NULL, command_digest text NOT NULL CONSTRAINT library_collection_receipts_digest_check CHECK(command_digest ~ '^[a-f0-9]{64}$'),
  command jsonb NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now() CONSTRAINT library_collection_receipts_time_check CHECK(isfinite(created_at)),
  FOREIGN KEY(collection_id,user_id) REFERENCES library_collections(id,user_id) ON DELETE CASCADE,
  CONSTRAINT library_collection_receipts_payload_check CHECK(coalesce(jsonb_typeof(command)='object' AND octet_length(command::text)<=2048 AND jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=2048,false))
);
--> statement-breakpoint
CREATE UNIQUE INDEX library_collection_receipts_user_request_idx ON library_collection_receipts(user_id,request_id);
--> statement-breakpoint
CREATE INDEX library_collection_receipts_history_idx ON library_collection_receipts(collection_id,created_at DESC,id DESC);
--> statement-breakpoint
CREATE FUNCTION library_collection_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN
      RAISE EXCEPTION 'Archive collections instead of deleting history' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtext('library-collections:' || NEW.user_id));
    IF NEW.revision<>1 OR NEW.status<>'active' OR (SELECT count(*) FROM library_collections WHERE user_id=NEW.user_id)>=30 THEN
      RAISE EXCEPTION 'Invalid collection creation or quota' USING ERRCODE='23514';
    END IF;
  ELSE
    IF (NEW.id,NEW.user_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.user_id,OLD.created_at) OR NEW.revision<>OLD.revision+1 OR NEW.updated_at<OLD.updated_at THEN
      RAISE EXCEPTION 'Collection identity and revisions are guarded' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER library_collection_guard BEFORE INSERT OR UPDATE OR DELETE ON library_collections FOR EACH ROW EXECUTE FUNCTION library_collection_guard();
--> statement-breakpoint
CREATE FUNCTION library_collection_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c library_collections;
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Remove and add references instead' USING ERRCODE='23514'; END IF;
  SELECT * INTO c FROM library_collections WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.collection_id ELSE NEW.collection_id END FOR NO KEY UPDATE;
  IF TG_OP='DELETE' AND c.id IS NULL THEN RETURN OLD; END IF;
  IF c.id IS NULL OR c.status<>'active' THEN RAISE EXCEPTION 'Collection is archived or absent' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' AND (SELECT count(*) FROM library_collection_items WHERE collection_id=c.id)>=200 THEN
    RAISE EXCEPTION 'Collection item quota exceeded' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER library_collection_item_guard BEFORE INSERT OR UPDATE OR DELETE ON library_collection_items FOR EACH ROW EXECUTE FUNCTION library_collection_item_guard();
--> statement-breakpoint
CREATE FUNCTION library_collection_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c library_collections; action text;
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Collection command receipts are immutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO c FROM library_collections WHERE id=NEW.collection_id AND user_id=NEW.user_id FOR NO KEY UPDATE;
  action:=NEW.command->>'action';
  IF c.id IS NULL OR NEW.command->>'requestId' IS DISTINCT FROM NEW.request_id::text OR action IS NULL OR action NOT IN ('create','rename','archive','restore','add','remove')
    OR (SELECT count(*) FROM library_collection_receipts WHERE collection_id=c.id)>=5000 THEN
    RAISE EXCEPTION 'Invalid collection command receipt or quota' USING ERRCODE='23514';
  END IF;
  IF action='create' THEN
    IF c.revision<>1 OR c.status<>'active' OR NEW.command->>'name' IS DISTINCT FROM c.name OR NEW.command-'action'-'requestId'-'name'<>'{}'::jsonb THEN
      RAISE EXCEPTION 'Invalid collection creation receipt' USING ERRCODE='23514';
    END IF;
  ELSE
    IF jsonb_typeof(NEW.command->'expectedRevision') IS DISTINCT FROM 'number' OR coalesce(NEW.command->>'expectedRevision','') !~ '^[1-9][0-9]*$' OR (NEW.command->>'expectedRevision')::integer<>c.revision-1
      OR (action IN ('rename','add','remove','restore') AND c.status<>'active') OR (action='archive' AND c.status<>'archived') THEN
      RAISE EXCEPTION 'Collection receipt must match the committed revision' USING ERRCODE='23514';
    END IF;
    IF action='rename' AND (NEW.command->>'name' IS DISTINCT FROM c.name OR NEW.command-'action'-'requestId'-'expectedRevision'-'name'<>'{}'::jsonb) THEN
      RAISE EXCEPTION 'Invalid collection rename receipt' USING ERRCODE='23514';
    ELSIF action IN ('add','remove') AND (coalesce(NEW.command->>'productId','') !~ '^[A-Za-z0-9_-]{1,160}$' OR NEW.command-'action'-'requestId'-'expectedRevision'-'productId'<>'{}'::jsonb) THEN
      RAISE EXCEPTION 'Invalid collection member receipt' USING ERRCODE='23514';
    ELSIF action IN ('archive','restore') AND NEW.command-'action'-'requestId'-'expectedRevision'<>'{}'::jsonb THEN
      RAISE EXCEPTION 'Invalid collection state receipt' USING ERRCODE='23514';
    END IF;
  END IF;
  NEW.snapshot:=jsonb_build_object('id',c.id,'name',c.name,'status',c.status,'revision',c.revision);
  NEW.created_at:=clock_timestamp();
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER library_collection_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON library_collection_receipts FOR EACH ROW EXECUTE FUNCTION library_collection_receipt_guard();
