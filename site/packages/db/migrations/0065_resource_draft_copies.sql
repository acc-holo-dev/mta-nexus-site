-- Future copies only: no historical provenance or artifact approval is inferred.
CREATE TABLE resource_draft_copies (
  id text PRIMARY KEY, actor_id text NOT NULL, request_id uuid NOT NULL,
  source_product_id text NOT NULL, target_product_id text NOT NULL UNIQUE,
  command_digest text NOT NULL CHECK(command_digest ~ '^[a-f0-9]{64}$'),
  snapshot jsonb NOT NULL DEFAULT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_id,request_id), CHECK(source_product_id<>target_product_id)
);
--> statement-breakpoint
CREATE INDEX resource_draft_copies_source_idx ON resource_draft_copies(source_product_id,created_at DESC,id DESC);
--> statement-breakpoint
CREATE FUNCTION resource_draft_copy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source products; target products;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Draft copy receipts are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.snapshot IS NOT NULL THEN
    RAISE EXCEPTION 'Draft copy snapshots must be recorded by the database' USING ERRCODE='23514';
  END IF;
  SELECT * INTO source FROM products WHERE id=NEW.source_product_id FOR SHARE;
  IF NOT FOUND OR source.price<>0 OR source.status='suspended' THEN
    RAISE EXCEPTION 'Copy source unavailable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO target FROM products WHERE id=NEW.target_product_id FOR SHARE;
  IF NOT FOUND OR target.status<>'draft' OR target.price<>0 OR target.currency<>'USD'
    OR target.license_model<>'unlimited' OR target.current_version<>'1.0.0' OR NOT target.metadata_review_required
    OR target.author_id<>source.author_id OR target.organization_id IS DISTINCT FROM source.organization_id
    OR target.rating_average<>0 OR target.rating_count<>0 OR target.sales_count<>0 OR target.is_featured
    OR target.thumbnail_url IS NOT NULL OR target.screenshots<>'[]'::jsonb
    OR EXISTS(SELECT 1 FROM builds WHERE product_id=target.id)
    OR EXISTS(SELECT 1 FROM resource_media WHERE product_id=target.id) THEN
    RAISE EXCEPTION 'Copy target must be a new unreviewed draft without artifacts' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM users WHERE id=NEW.actor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Copy actor unavailable' USING ERRCODE='23514'; END IF;
  NEW.snapshot:=jsonb_build_object('version',1,'source',jsonb_build_object('id',source.id,'title',left(source.title,120)),
    'target',jsonb_build_object('id',target.id,'title',target.title,'slug',target.slug,'createdStatus','draft'),
    'metadata',jsonb_build_object('description',target.description,'shortDescription',coalesce(target.short_description,''),
      'type',target.type,'tags',target.tags,'compatibility',target.compatibility));
  NEW.created_at:=clock_timestamp();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER resource_draft_copy_guard BEFORE INSERT OR UPDATE OR DELETE ON resource_draft_copies
  FOR EACH ROW EXECUTE FUNCTION resource_draft_copy_guard();
