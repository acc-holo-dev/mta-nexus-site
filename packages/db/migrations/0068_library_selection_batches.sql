-- Batch receipts preserve version identities without granting access or installation.
CREATE TABLE library_selection_batch_receipts (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, collection_id text NOT NULL,
 command_digest text NOT NULL CONSTRAINT library_selection_batch_receipts_digest_check CHECK(command_digest ~ '^[a-f0-9]{64}$'),
 command jsonb NOT NULL, snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now() CONSTRAINT library_selection_batch_receipts_time_check CHECK(isfinite(created_at)),
 FOREIGN KEY(collection_id,user_id) REFERENCES library_collections(id,user_id) ON DELETE CASCADE,
 CONSTRAINT library_selection_batch_receipts_payload_check CHECK(coalesce(jsonb_typeof(command)='object' AND octet_length(command::text)<=8192 AND jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=32768,false))
);
--> statement-breakpoint
CREATE UNIQUE INDEX library_selection_batch_receipts_request_idx ON library_selection_batch_receipts(user_id,request_id);
--> statement-breakpoint
CREATE INDEX library_selection_batch_receipts_history_idx ON library_selection_batch_receipts(collection_id,created_at DESC,id DESC);
--> statement-breakpoint
CREATE FUNCTION library_selection_batch_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c library_collections; entry jsonb; selection_row resource_library_selections; ids text[]; item_ids text[];
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Selection batch receipts are immutable' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('library-collections:' || NEW.user_id));
 SELECT * INTO c FROM library_collections WHERE id=NEW.collection_id AND user_id=NEW.user_id FOR SHARE;
 IF c.id IS NULL OR c.status<>'active' OR (SELECT count(*) FROM library_selection_batch_receipts WHERE user_id=NEW.user_id)>=5000
   OR NEW.command->>'requestId' IS DISTINCT FROM NEW.request_id::text
   OR coalesce(NEW.command->>'previewDigest','') !~ '^[a-f0-9]{64}$'
   OR coalesce(NEW.command->>'mode','') NOT IN ('fixed','latest')
   OR NEW.command-'requestId'-'mode'-'previewDigest'-'productIds'<>'{}'::jsonb
   OR jsonb_typeof(NEW.command->'productIds') IS DISTINCT FROM 'array'
   OR jsonb_typeof(NEW.snapshot->'items') IS DISTINCT FROM 'array'
   OR NEW.snapshot->>'collectionId' IS DISTINCT FROM c.id
   OR NEW.snapshot->'collectionRevision' IS DISTINCT FROM to_jsonb(c.revision)
   OR NEW.snapshot->>'mode' IS DISTINCT FROM NEW.command->>'mode'
   OR NEW.snapshot-'collectionId'-'collectionRevision'-'mode'-'items'<>'{}'::jsonb THEN
   RAISE EXCEPTION 'Invalid selection batch receipt' USING ERRCODE='23514';
 END IF;
 SELECT array_agg(value ORDER BY value) INTO ids FROM jsonb_array_elements_text(NEW.command->'productIds');
 SELECT array_agg(value->>'productId' ORDER BY value->>'productId') INTO item_ids FROM jsonb_array_elements(NEW.snapshot->'items');
 IF coalesce(cardinality(ids),0) NOT BETWEEN 1 AND 20
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.command->'productIds') value WHERE jsonb_typeof(value)<>'string')
   OR ids IS DISTINCT FROM item_ids
   OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) THEN
   RAISE EXCEPTION 'Invalid selection batch members' USING ERRCODE='23514';
 END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(NEW.snapshot->'items') LOOP
   IF NOT EXISTS(SELECT 1 FROM library_collection_items WHERE collection_id=c.id AND product_id=entry->>'productId')
     OR jsonb_typeof(entry->'productId') IS DISTINCT FROM 'string'
     OR entry-'productId'-'previous'-'next'<>'{}'::jsonb
     OR jsonb_typeof(entry->'previous') IS DISTINCT FROM 'object'
     OR jsonb_typeof(entry->'next') IS DISTINCT FROM 'object'
     OR (entry->'previous')-'revision'-'mode'-'buildId'<>'{}'::jsonb
     OR (entry->'next')-'revision'-'mode'-'buildId'<>'{}'::jsonb
     OR jsonb_typeof(entry->'previous'->'revision') IS DISTINCT FROM 'number'
     OR coalesce(entry->'previous'->>'revision','') !~ '^(0|[1-9][0-9]*)$'
     OR coalesce(entry->'previous'->>'mode','') NOT IN ('fixed','latest')
     OR (entry->'previous'->>'mode'='latest' AND entry->'previous'->'buildId' IS DISTINCT FROM 'null'::jsonb)
     OR (entry->'previous'->>'mode'='fixed' AND (jsonb_typeof(entry->'previous'->'buildId') IS DISTINCT FROM 'string' OR coalesce(entry->'previous'->>'buildId','') !~ '^[A-Za-z0-9_-]{1,128}$' OR (entry->'previous'->>'revision')::bigint<1)) THEN
     RAISE EXCEPTION 'Invalid selection batch snapshot' USING ERRCODE='23514';
   END IF;
   SELECT * INTO selection_row FROM resource_library_selections WHERE user_id=NEW.user_id AND product_id=entry->>'productId' FOR SHARE;
   IF selection_row.product_id IS NULL THEN
     IF entry->'next'<>jsonb_build_object('revision',0,'mode','latest','buildId',NULL) OR NEW.command->>'mode'<>'latest' THEN
       RAISE EXCEPTION 'Selection batch must match committed state' USING ERRCODE='23514';
     END IF;
   ELSIF entry->'next'<>jsonb_build_object('revision',selection_row.revision,'mode',selection_row.mode,'buildId',selection_row.build_id) OR selection_row.mode<>NEW.command->>'mode' THEN
     RAISE EXCEPTION 'Selection batch must match committed state' USING ERRCODE='23514';
   END IF;
   IF entry->'next'->'revision' IS DISTINCT FROM to_jsonb((entry->'previous'->>'revision')::bigint +
     CASE WHEN (entry->'next'->'mode',entry->'next'->'buildId') IS DISTINCT FROM (entry->'previous'->'mode',entry->'previous'->'buildId') THEN 1 ELSE 0 END) THEN
     RAISE EXCEPTION 'Selection batch must use a successor revision' USING ERRCODE='23514';
   END IF;
 END LOOP;
 NEW.created_at:=clock_timestamp();
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER library_selection_batch_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON library_selection_batch_receipts FOR EACH ROW EXECUTE FUNCTION library_selection_batch_receipt_guard();
