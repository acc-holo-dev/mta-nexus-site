-- Expand bounded command receipts for at most twenty private resource references.
ALTER TABLE library_collection_receipts DROP CONSTRAINT library_collection_receipts_payload_check;
--> statement-breakpoint
ALTER TABLE library_collection_receipts ADD CONSTRAINT library_collection_receipts_payload_check CHECK(coalesce(jsonb_typeof(command)='object' AND octet_length(command::text)<=8192 AND jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=2048,false));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION library_collection_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c library_collections; action text; entry jsonb;
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Collection command receipts are immutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO c FROM library_collections WHERE id=NEW.collection_id AND user_id=NEW.user_id FOR NO KEY UPDATE;
  action:=NEW.command->>'action';
  IF c.id IS NULL OR NEW.command->>'requestId' IS DISTINCT FROM NEW.request_id::text OR action IS NULL OR action NOT IN ('create','rename','archive','restore','add','remove','add-many','remove-many')
    OR (SELECT count(*) FROM library_collection_receipts WHERE collection_id=c.id)>=5000 THEN
    RAISE EXCEPTION 'Invalid collection command receipt or quota' USING ERRCODE='23514';
  END IF;
  IF action='create' THEN
    IF c.revision<>1 OR c.status<>'active' OR NEW.command->>'name' IS DISTINCT FROM c.name OR NEW.command-'action'-'requestId'-'name'<>'{}'::jsonb THEN
      RAISE EXCEPTION 'Invalid collection creation receipt' USING ERRCODE='23514';
    END IF;
  ELSE
    IF jsonb_typeof(NEW.command->'expectedRevision') IS DISTINCT FROM 'number' OR coalesce(NEW.command->>'expectedRevision','') !~ '^[1-9][0-9]*$' OR (NEW.command->>'expectedRevision')::integer<>c.revision-1
      OR (action IN ('rename','add','remove','restore','add-many','remove-many') AND c.status<>'active') OR (action='archive' AND c.status<>'archived') THEN
      RAISE EXCEPTION 'Collection receipt must match the committed revision' USING ERRCODE='23514';
    END IF;
    IF action='rename' AND (NEW.command->>'name' IS DISTINCT FROM c.name OR NEW.command-'action'-'requestId'-'expectedRevision'-'name'<>'{}'::jsonb) THEN
      RAISE EXCEPTION 'Invalid collection rename receipt' USING ERRCODE='23514';
    ELSIF action IN ('add','remove') AND (coalesce(NEW.command->>'productId','') !~ '^[A-Za-z0-9_-]{1,160}$' OR NEW.command-'action'-'requestId'-'expectedRevision'-'productId'<>'{}'::jsonb) THEN
      RAISE EXCEPTION 'Invalid collection member receipt' USING ERRCODE='23514';
    ELSIF action IN ('add-many','remove-many') THEN
      IF NEW.command-'action'-'requestId'-'expectedRevision'-'productIds'<>'{}'::jsonb OR jsonb_typeof(NEW.command->'productIds') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid collection batch shape' USING ERRCODE='23514';
      END IF;
      IF jsonb_array_length(NEW.command->'productIds') NOT BETWEEN 1 AND 20
        OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(NEW.command->'productIds'))<>jsonb_array_length(NEW.command->'productIds') THEN
        RAISE EXCEPTION 'Invalid collection batch size or duplicate references' USING ERRCODE='23514';
      END IF;
      FOR entry IN SELECT value FROM jsonb_array_elements(NEW.command->'productIds') LOOP
        IF jsonb_typeof(entry) IS DISTINCT FROM 'string' OR (entry #>> '{}') !~ '^[A-Za-z0-9_-]{1,160}$' THEN
          RAISE EXCEPTION 'Invalid collection batch reference' USING ERRCODE='23514';
        END IF;
        IF (action='add-many') IS DISTINCT FROM EXISTS(SELECT 1 FROM library_collection_items WHERE collection_id=c.id AND product_id=(entry #>> '{}')) THEN
          RAISE EXCEPTION 'Collection batch receipt must match committed membership' USING ERRCODE='23514';
        END IF;
      END LOOP;
    ELSIF action IN ('archive','restore') AND NEW.command-'action'-'requestId'-'expectedRevision'<>'{}'::jsonb THEN
      RAISE EXCEPTION 'Invalid collection state receipt' USING ERRCODE='23514';
    END IF;
  END IF;
  NEW.snapshot:=jsonb_build_object('id',c.id,'name',c.name,'status',c.status,'revision',c.revision);
  NEW.created_at:=clock_timestamp();
  RETURN NEW;
END $$;
