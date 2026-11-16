-- One immutable parent proves an atomic resource membership change across own collections.
CREATE TABLE library_membership_batch_receipts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  product_id text NOT NULL,
  command_digest text NOT NULL,
  command jsonb NOT NULL,
  child_receipt_ids text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_membership_batches_shape_check CHECK (
    product_id ~ '^[A-Za-z0-9_-]{1,160}$' AND command_digest ~ '^[a-f0-9]{64}$'
    AND coalesce(jsonb_typeof(command)='object' AND octet_length(command::text)<=8192
      AND array_ndims(child_receipt_ids)=1 AND cardinality(child_receipt_ids) BETWEEN 1 AND 20,false)),
  CONSTRAINT library_membership_batches_time_check CHECK (isfinite(created_at))
);
--> statement-breakpoint
CREATE UNIQUE INDEX library_membership_batches_user_request_idx ON library_membership_batch_receipts(user_id,request_id);
--> statement-breakpoint
CREATE INDEX library_membership_batches_resource_history_idx ON library_membership_batch_receipts(user_id,product_id,created_at DESC,id DESC);
--> statement-breakpoint
CREATE FUNCTION library_membership_batch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry jsonb; child_position integer:=0; child library_collection_receipts; current_collection library_collections;
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Membership batch receipts are immutable' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('library-collections:'||NEW.user_id));
  PERFORM 1 FROM users WHERE id=NEW.user_id FOR SHARE;
  IF NOT FOUND OR NEW.command-'requestId'-'changes'<>'{}'::jsonb
    OR NEW.command->>'requestId' IS DISTINCT FROM NEW.request_id::text
    OR jsonb_typeof(NEW.command->'changes') IS DISTINCT FROM 'array'
    OR (SELECT count(*) FROM library_membership_batch_receipts WHERE user_id=NEW.user_id)>=5000
    OR EXISTS(SELECT 1 FROM library_membership_batch_receipts WHERE user_id=NEW.user_id AND child_receipt_ids && NEW.child_receipt_ids) THEN
    RAISE EXCEPTION 'Invalid membership batch or quota' USING ERRCODE='23514';
  END IF;
  IF jsonb_array_length(NEW.command->'changes') NOT BETWEEN 1 AND 20
    OR jsonb_array_length(NEW.command->'changes')<>cardinality(NEW.child_receipt_ids)
    OR (SELECT count(DISTINCT value->>'collectionId') FROM jsonb_array_elements(NEW.command->'changes'))<>jsonb_array_length(NEW.command->'changes')
    OR (SELECT count(DISTINCT value) FROM unnest(NEW.child_receipt_ids) value)<>cardinality(NEW.child_receipt_ids) THEN
    RAISE EXCEPTION 'Invalid membership batch size or duplicates' USING ERRCODE='23514';
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(NEW.command->'changes') LOOP
    child_position:=child_position+1;
    IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR entry-'collectionId'-'expectedRevision'-'wasInCollection'-'inCollection'<>'{}'::jsonb
      OR jsonb_typeof(entry->'collectionId') IS DISTINCT FROM 'string' OR coalesce(entry->>'collectionId','') !~ '^[A-Za-z0-9_-]{1,160}$'
      OR jsonb_typeof(entry->'expectedRevision') IS DISTINCT FROM 'number' OR coalesce(entry->>'expectedRevision','') !~ '^[1-9][0-9]{0,9}$'
      OR jsonb_typeof(entry->'wasInCollection') IS DISTINCT FROM 'boolean' OR jsonb_typeof(entry->'inCollection') IS DISTINCT FROM 'boolean'
      OR entry->'wasInCollection'=entry->'inCollection' THEN
      RAISE EXCEPTION 'Invalid membership change' USING ERRCODE='23514';
    END IF;
    IF (entry->>'expectedRevision')::numeric NOT BETWEEN 1 AND 2147483646 THEN
      RAISE EXCEPTION 'Invalid membership revision' USING ERRCODE='23514';
    END IF;
    SELECT * INTO child FROM library_collection_receipts WHERE id=NEW.child_receipt_ids[child_position] AND user_id=NEW.user_id;
    SELECT * INTO current_collection FROM library_collections WHERE id=entry->>'collectionId' AND user_id=NEW.user_id FOR NO KEY UPDATE;
    IF child.id IS NULL OR current_collection.id IS NULL OR child.collection_id<>current_collection.id
      OR child.request_id=NEW.request_id OR current_collection.status<>'active'
      OR current_collection.revision<>(entry->>'expectedRevision')::integer+1
      OR child.command IS DISTINCT FROM jsonb_build_object('requestId',child.request_id::text,'action',CASE WHEN (entry->>'inCollection')::boolean THEN 'add' ELSE 'remove' END,'productId',NEW.product_id,'expectedRevision',(entry->>'expectedRevision')::integer)
      OR child.snapshot IS DISTINCT FROM jsonb_build_object('id',current_collection.id,'name',current_collection.name,'status',current_collection.status,'revision',current_collection.revision)
      OR (entry->>'inCollection')::boolean IS DISTINCT FROM EXISTS(SELECT 1 FROM library_collection_items WHERE collection_id=current_collection.id AND product_id=NEW.product_id) THEN
      RAISE EXCEPTION 'Membership batch must match every own child receipt and successor' USING ERRCODE='23514';
    END IF;
  END LOOP;
  NEW.created_at:=clock_timestamp();
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER library_membership_batch_guard BEFORE INSERT OR UPDATE OR DELETE ON library_membership_batch_receipts FOR EACH ROW EXECUTE FUNCTION library_membership_batch_guard();
