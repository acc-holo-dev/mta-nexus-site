-- Only published zero-price plans can create subscriptions. No legacy activation,
-- provider confirmation, resource license or balance movement is inferred.
CREATE TABLE account_subscriptions (
  id text PRIMARY KEY, subject_type text NOT NULL CHECK(subject_type IN ('user','organization')), subject_id text NOT NULL,
  actor_id text NOT NULL, plan_id text NOT NULL, plan_revision integer NOT NULL,
  terms_snapshot jsonb NOT NULL DEFAULT NULL, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz,
  FOREIGN KEY(plan_id,plan_revision) REFERENCES commercial_plan_revisions(plan_id,revision) ON DELETE RESTRICT,
  CHECK(isfinite(started_at) AND isfinite(expires_at) AND expires_at>started_at),
  CHECK((status='cancelled')=(cancelled_at IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX account_subscriptions_active_idx ON account_subscriptions(subject_type,subject_id) WHERE status='active';
--> statement-breakpoint
CREATE INDEX account_subscriptions_subject_time_idx ON account_subscriptions(subject_type,subject_id,started_at DESC,id DESC);
--> statement-breakpoint
CREATE TABLE subscription_receipts (
  id text PRIMARY KEY, actor_id text NOT NULL, request_id uuid NOT NULL, subscription_id text NOT NULL REFERENCES account_subscriptions(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK(action IN ('activate','cancel')), command_digest text NOT NULL CHECK(command_digest ~ '^[a-f0-9]{64}$'),
  snapshot jsonb NOT NULL DEFAULT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,request_id)
);
--> statement-breakpoint
CREATE INDEX subscription_receipts_subscription_time_idx ON subscription_receipts(subscription_id,created_at DESC,id DESC);
--> statement-breakpoint
CREATE FUNCTION account_subscription_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p commercial_plans; v commercial_plan_revisions; observed timestamptz;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Subscriptions retain immutable terms' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'status'-'cancelled_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'cancelled_at') OR OLD.status<>'active' THEN
      RAISE EXCEPTION 'Subscription terms and terminal states are immutable' USING ERRCODE='23514';
    END IF;
    observed:=date_trunc('milliseconds',clock_timestamp());
    IF NEW.status='expired' AND OLD.expires_at<=observed AND NEW.cancelled_at IS NULL THEN RETURN NEW; END IF;
    IF NEW.status='cancelled' AND observed>=OLD.started_at AND OLD.expires_at>observed AND NEW.cancelled_at IS NULL THEN
      NEW.cancelled_at:=observed; RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Invalid subscription transition' USING ERRCODE='23514';
  END IF;
  IF NEW.terms_snapshot IS NOT NULL OR NEW.status<>'active' OR NEW.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Subscription terms must be recorded by the database' USING ERRCODE='23514';
  END IF;
  SELECT * INTO p FROM commercial_plans WHERE id=NEW.plan_id FOR SHARE;
  IF NOT FOUND OR p.status<>'published' OR p.revision<>NEW.plan_revision OR p.scope<>NEW.subject_type THEN
    RAISE EXCEPTION 'Published subscription plan changed' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v FROM commercial_plan_revisions WHERE plan_id=NEW.plan_id AND revision=NEW.plan_revision;
  IF NOT FOUND OR v.status<>'published' OR (v.terms->>'price')::integer<>0 THEN
    RAISE EXCEPTION 'Paid subscription requires provider confirmation' USING ERRCODE='23514';
  END IF;
  IF NEW.subject_type='user' AND NEW.subject_id<>NEW.actor_id THEN
    RAISE EXCEPTION 'Personal subscription subject differs' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM users WHERE id=NEW.actor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription actor unavailable' USING ERRCODE='23514'; END IF;
  IF NEW.subject_type='organization' THEN
    PERFORM 1 FROM organizations WHERE id=NEW.subject_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Subscription organization unavailable' USING ERRCODE='23514'; END IF;
  END IF;
  NEW.terms_snapshot:=jsonb_build_object('titleRu',v.terms->'titleRu','titleEn',v.terms->'titleEn',
    'descriptionRu',v.terms->'descriptionRu','descriptionEn',v.terms->'descriptionEn','price',v.terms->'price',
    'currency',v.terms->'currency','durationDays',v.terms->'durationDays','commissionBps',v.terms->'commissionBps');
  NEW.started_at:=date_trunc('milliseconds',clock_timestamp());
  NEW.expires_at:=NEW.started_at + ((v.terms->>'durationDays')::integer * 86400) * interval '1 second';
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER account_subscription_guard BEFORE INSERT OR UPDATE OR DELETE ON account_subscriptions FOR EACH ROW EXECUTE FUNCTION account_subscription_guard();
--> statement-breakpoint
CREATE FUNCTION subscription_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s account_subscriptions;
BEGIN
  IF TG_OP<>'INSERT' OR NEW.snapshot IS NOT NULL THEN RAISE EXCEPTION 'Subscription receipts are immutable and database generated' USING ERRCODE='23514'; END IF;
  SELECT * INTO s FROM account_subscriptions WHERE id=NEW.subscription_id FOR SHARE;
  IF NOT FOUND OR (NEW.action='activate' AND s.status<>'active') OR (NEW.action='cancel' AND s.status<>'cancelled') THEN
    RAISE EXCEPTION 'Subscription receipt state differs' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM users WHERE id=NEW.actor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt actor unavailable' USING ERRCODE='23514'; END IF;
  NEW.snapshot:=jsonb_build_object('version',1,'id',s.id,'subjectType',s.subject_type,'subjectId',s.subject_id,
    'planId',s.plan_id,'planRevision',s.plan_revision,'terms',s.terms_snapshot,'status',s.status,
    'startedAt',s.started_at,'expiresAt',s.expires_at,'cancelledAt',s.cancelled_at);
  NEW.created_at:=date_trunc('milliseconds',clock_timestamp()); RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER subscription_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON subscription_receipts FOR EACH ROW EXECUTE FUNCTION subscription_receipt_guard();
