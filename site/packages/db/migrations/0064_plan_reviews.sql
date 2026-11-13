-- A saved selection is neither a payment quote guarantee nor a subscription.
CREATE TABLE commercial_plan_reviews (
  id text PRIMARY KEY, actor_id text NOT NULL, request_id uuid NOT NULL,
  subject_type text NOT NULL CHECK(subject_type IN ('user','organization')), subject_id text NOT NULL,
  plan_id text NOT NULL, plan_revision integer NOT NULL,
  gross_amount integer NOT NULL CHECK(gross_amount BETWEEN 0 AND 100000000),
  currency text NOT NULL CHECK(currency IN ('USD','EUR','RUB')),
  terms_snapshot jsonb NOT NULL DEFAULT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(plan_id,plan_revision) REFERENCES commercial_plan_revisions(plan_id,revision) ON DELETE RESTRICT,
  UNIQUE(actor_id,request_id),
  CONSTRAINT commercial_plan_reviews_terms_check CHECK((jsonb_typeof(terms_snapshot) = 'object'
    AND terms_snapshot ?& ARRAY['titleRu','titleEn','descriptionRu','descriptionEn','price','currency','durationDays','commissionBps']
    AND jsonb_typeof(terms_snapshot->'titleRu')='string' AND length(btrim(terms_snapshot->>'titleRu')) BETWEEN 3 AND 100
    AND jsonb_typeof(terms_snapshot->'titleEn')='string' AND length(btrim(terms_snapshot->>'titleEn')) BETWEEN 3 AND 100
    AND jsonb_typeof(terms_snapshot->'descriptionRu')='string' AND length(btrim(terms_snapshot->>'descriptionRu')) BETWEEN 10 AND 2000
    AND jsonb_typeof(terms_snapshot->'descriptionEn')='string' AND length(btrim(terms_snapshot->>'descriptionEn')) BETWEEN 10 AND 2000
    AND jsonb_typeof(terms_snapshot->'price')='number' AND (terms_snapshot->>'price')::integer BETWEEN 0 AND 100000000
    AND jsonb_typeof(terms_snapshot->'commissionBps')='number' AND (terms_snapshot->>'commissionBps')::integer BETWEEN 0 AND 1000
    AND jsonb_typeof(terms_snapshot->'durationDays')='number' AND (terms_snapshot->>'durationDays')::integer IN (7,30,90,365)
    AND jsonb_typeof(terms_snapshot->'currency')='string' AND terms_snapshot->>'currency' IN ('USD','EUR','RUB')) IS TRUE)
);
--> statement-breakpoint
CREATE INDEX commercial_plan_reviews_account_idx ON commercial_plan_reviews(subject_type,subject_id,created_at DESC,id DESC);
--> statement-breakpoint
CREATE FUNCTION commercial_plan_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p commercial_plans; v commercial_plan_revisions;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Saved plan reviews are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.terms_snapshot IS NOT NULL THEN
    RAISE EXCEPTION 'Plan review terms must be recorded by the database' USING ERRCODE='23514';
  END IF;
  SELECT * INTO p FROM commercial_plans WHERE id=NEW.plan_id FOR SHARE;
  IF NOT FOUND OR p.status<>'published' OR p.revision<>NEW.plan_revision OR p.scope<>NEW.subject_type THEN
    RAISE EXCEPTION 'Published plan changed' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v FROM commercial_plan_revisions WHERE plan_id=p.id AND revision=p.revision;
  IF NOT FOUND OR v.status<>'published' THEN
    RAISE EXCEPTION 'Published plan changed' USING ERRCODE='23514';
  END IF;
  IF NEW.subject_type='user' AND NEW.subject_id<>NEW.actor_id THEN
    RAISE EXCEPTION 'Personal review subject differs' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM users WHERE id=NEW.actor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review actor unavailable' USING ERRCODE='23514'; END IF;
  IF NEW.subject_type='organization' THEN
    PERFORM 1 FROM organizations WHERE id=NEW.subject_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Review subject unavailable' USING ERRCODE='23514'; END IF;
  END IF;
  -- Only documented fields; future/private version JSON cannot enter the receipt.
  NEW.terms_snapshot := jsonb_build_object('titleRu',v.terms->'titleRu','titleEn',v.terms->'titleEn',
    'descriptionRu',v.terms->'descriptionRu','descriptionEn',v.terms->'descriptionEn',
    'price',v.terms->'price','currency',v.terms->'currency','durationDays',v.terms->'durationDays','commissionBps',v.terms->'commissionBps');
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER commercial_plan_review_guard BEFORE INSERT OR UPDATE OR DELETE ON commercial_plan_reviews
  FOR EACH ROW EXECUTE FUNCTION commercial_plan_review_guard();
