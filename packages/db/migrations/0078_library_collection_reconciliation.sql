-- Reconciliation proves bounded mixed additions/removals while retaining all prior receipt guards.
CREATE OR REPLACE FUNCTION library_collection_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c library_collections; action text; entry jsonb; source library_collections;
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Collection command receipts are immutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO c FROM library_collections WHERE id=NEW.collection_id AND user_id=NEW.user_id FOR NO KEY UPDATE;
  action:=NEW.command->>'action';
  IF c.id IS NULL OR NEW.command->>'requestId' IS DISTINCT FROM NEW.request_id::text OR action IS NULL OR action NOT IN ('create','rename','archive','restore','add','remove','add-many','remove-many','duplicate','copy-items','move-items','reconcile-items')
    OR (SELECT count(*) FROM library_collection_receipts r WHERE r.user_id=NEW.user_id AND (r.collection_id=c.id OR (r.command->>'action'='move-items' AND r.command->>'sourceCollectionId'=c.id)))>=5000 THEN
    RAISE EXCEPTION 'Invalid collection command receipt or quota' USING ERRCODE='23514';
  END IF;
  IF action IN ('create','duplicate') THEN
    IF c.revision<>1 OR c.status<>'active' OR NEW.command->>'name' IS DISTINCT FROM c.name OR (action='create' AND NEW.command-'action'-'requestId'-'name'<>'{}'::jsonb) THEN
      RAISE EXCEPTION 'Invalid collection creation receipt' USING ERRCODE='23514';
    END IF;
    IF action='duplicate' THEN
      IF jsonb_typeof(NEW.command->'name') IS DISTINCT FROM 'string' OR NEW.command-'action'-'requestId'-'name'-'sourceCollectionId'-'expectedRevision'-'expectedItemCount'-'sourceDigest'<>'{}'::jsonb
        OR jsonb_typeof(NEW.command->'sourceCollectionId') IS DISTINCT FROM 'string' OR coalesce(NEW.command->>'sourceCollectionId','') !~ '^[A-Za-z0-9_-]{1,160}$'
        OR jsonb_typeof(NEW.command->'sourceDigest') IS DISTINCT FROM 'string' OR coalesce(NEW.command->>'sourceDigest','') !~ '^[a-f0-9]{64}$'
        OR jsonb_typeof(NEW.command->'expectedRevision') IS DISTINCT FROM 'number' OR coalesce(NEW.command->>'expectedRevision','') !~ '^[1-9][0-9]*$'
        OR jsonb_typeof(NEW.command->'expectedItemCount') IS DISTINCT FROM 'number' OR coalesce(NEW.command->>'expectedItemCount','') !~ '^(0|[1-9][0-9]*)$' THEN
        RAISE EXCEPTION 'Invalid collection copy shape' USING ERRCODE='23514';
      END IF;
      SELECT * INTO source FROM library_collections WHERE id=NEW.command->>'sourceCollectionId' AND user_id=NEW.user_id FOR SHARE;
      IF source.id IS NULL OR source.id=c.id OR (NEW.command->>'expectedRevision')::numeric<>source.revision
        OR (NEW.command->>'expectedItemCount')::numeric NOT BETWEEN 0 AND 200
        OR (NEW.command->>'expectedItemCount')::numeric<>(SELECT count(*) FROM library_collection_items WHERE collection_id=source.id)
        OR EXISTS(SELECT product_id FROM library_collection_items WHERE collection_id=source.id EXCEPT SELECT product_id FROM library_collection_items WHERE collection_id=c.id)
        OR EXISTS(SELECT product_id FROM library_collection_items WHERE collection_id=c.id EXCEPT SELECT product_id FROM library_collection_items WHERE collection_id=source.id) THEN
        RAISE EXCEPTION 'Collection copy receipt must match its owned source and contents' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSE
    IF jsonb_typeof(NEW.command->'expectedRevision') IS DISTINCT FROM 'number' OR coalesce(NEW.command->>'expectedRevision','') !~ '^[1-9][0-9]*$' OR (NEW.command->>'expectedRevision')::integer<>c.revision-1
      OR (action IN ('rename','add','remove','restore','add-many','remove-many','copy-items','move-items','reconcile-items') AND c.status<>'active') OR (action='archive' AND c.status<>'archived') THEN
      RAISE EXCEPTION 'Collection receipt must match the committed revision' USING ERRCODE='23514';
    END IF;
    IF action='rename' AND (NEW.command->>'name' IS DISTINCT FROM c.name OR NEW.command-'action'-'requestId'-'expectedRevision'-'name'<>'{}'::jsonb) THEN
      RAISE EXCEPTION 'Invalid collection rename receipt' USING ERRCODE='23514';
    ELSIF action IN ('add','remove') AND (coalesce(NEW.command->>'productId','') !~ '^[A-Za-z0-9_-]{1,160}$' OR NEW.command-'action'-'requestId'-'expectedRevision'-'productId'<>'{}'::jsonb) THEN
      RAISE EXCEPTION 'Invalid collection member receipt' USING ERRCODE='23514';
    ELSIF action='reconcile-items' THEN
      IF NEW.command-'action'-'requestId'-'expectedRevision'-'addProductIds'-'removeProductIds'<>'{}'::jsonb
        OR jsonb_typeof(NEW.command->'addProductIds') IS DISTINCT FROM 'array'
        OR jsonb_typeof(NEW.command->'removeProductIds') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid reconciliation shape' USING ERRCODE='23514';
      END IF;
      IF jsonb_array_length(NEW.command->'addProductIds')+jsonb_array_length(NEW.command->'removeProductIds') NOT BETWEEN 1 AND 20
        OR (SELECT count(DISTINCT value) FROM jsonb_array_elements((NEW.command->'addProductIds')||(NEW.command->'removeProductIds')))
          <>jsonb_array_length(NEW.command->'addProductIds')+jsonb_array_length(NEW.command->'removeProductIds') THEN
        RAISE EXCEPTION 'Invalid reconciliation size, duplicate or overlapping references' USING ERRCODE='23514';
      END IF;
      FOR entry IN SELECT value FROM jsonb_array_elements(NEW.command->'addProductIds') LOOP
        IF jsonb_typeof(entry) IS DISTINCT FROM 'string' OR (entry #>> '{}') !~ '^[A-Za-z0-9_-]{1,160}$'
          OR NOT EXISTS(SELECT 1 FROM library_collection_items WHERE collection_id=c.id AND product_id=(entry #>> '{}')) THEN
          RAISE EXCEPTION 'Reconciliation additions must match committed membership' USING ERRCODE='23514';
        END IF;
      END LOOP;
      FOR entry IN SELECT value FROM jsonb_array_elements(NEW.command->'removeProductIds') LOOP
        IF jsonb_typeof(entry) IS DISTINCT FROM 'string' OR (entry #>> '{}') !~ '^[A-Za-z0-9_-]{1,160}$'
          OR EXISTS(SELECT 1 FROM library_collection_items WHERE collection_id=c.id AND product_id=(entry #>> '{}')) THEN
          RAISE EXCEPTION 'Reconciliation removals must match committed membership' USING ERRCODE='23514';
        END IF;
      END LOOP;
    ELSIF action IN ('add-many','remove-many','copy-items','move-items') THEN
      IF action IN ('copy-items','move-items') THEN
        IF NEW.command-'action'-'requestId'-'expectedRevision'-'productIds'-'sourceCollectionId'-'expectedSourceRevision'<>'{}'::jsonb
          OR jsonb_typeof(NEW.command->'sourceCollectionId') IS DISTINCT FROM 'string'
          OR coalesce(NEW.command->>'sourceCollectionId','') !~ '^[A-Za-z0-9_-]{1,160}$'
          OR jsonb_typeof(NEW.command->'expectedSourceRevision') IS DISTINCT FROM 'number'
          OR coalesce(NEW.command->>'expectedSourceRevision','') !~ '^[1-9][0-9]*$' THEN
          RAISE EXCEPTION 'Invalid selected collection copy shape' USING ERRCODE='23514';
        END IF;
        SELECT * INTO source FROM library_collections WHERE id=NEW.command->>'sourceCollectionId' AND user_id=NEW.user_id FOR SHARE;
        IF source.id IS NULL OR source.id=c.id OR (NEW.command->>'expectedSourceRevision')::numeric<>source.revision-CASE WHEN action='move-items' THEN 1 ELSE 0 END THEN
          RAISE EXCEPTION 'Selected collection transfer must match its owned source revision' USING ERRCODE='23514';
        END IF;
        IF action='move-items' AND (source.status<>'active' OR (SELECT count(*) FROM library_collection_receipts r WHERE r.user_id=NEW.user_id AND (r.collection_id=source.id OR (r.command->>'action'='move-items' AND r.command->>'sourceCollectionId'=source.id)))>=5000) THEN
          RAISE EXCEPTION 'Move source is archived or history quota is exhausted' USING ERRCODE='23514';
        END IF;
      ELSIF NEW.command-'action'-'requestId'-'expectedRevision'-'productIds'<>'{}'::jsonb THEN
        RAISE EXCEPTION 'Invalid collection batch shape' USING ERRCODE='23514';
      END IF;
      IF jsonb_typeof(NEW.command->'productIds') IS DISTINCT FROM 'array' THEN
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
        IF (action IN ('add-many','copy-items','move-items')) IS DISTINCT FROM EXISTS(SELECT 1 FROM library_collection_items WHERE collection_id=c.id AND product_id=(entry #>> '{}')) THEN
          RAISE EXCEPTION 'Collection batch receipt must match committed membership' USING ERRCODE='23514';
        END IF;
        IF action='copy-items' AND NOT EXISTS(SELECT 1 FROM library_collection_items WHERE collection_id=source.id AND product_id=(entry #>> '{}')) THEN
          RAISE EXCEPTION 'Selected collection copy must match source membership' USING ERRCODE='23514';
        END IF;
        IF action='move-items' AND EXISTS(SELECT 1 FROM library_collection_items WHERE collection_id=source.id AND product_id=(entry #>> '{}')) THEN
          RAISE EXCEPTION 'Move receipt must prove removal from its source' USING ERRCODE='23514';
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
