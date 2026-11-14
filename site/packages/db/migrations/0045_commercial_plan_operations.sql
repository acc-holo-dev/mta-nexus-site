CREATE TABLE "commercial_plans" (
  "id" text PRIMARY KEY, "slug" text NOT NULL, "scope" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft', "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "commercial_plan_scope_check" CHECK ("scope" IN ('user', 'organization')),
  CONSTRAINT "commercial_plan_status_check" CHECK ("status" IN ('draft', 'published', 'archived')),
  CONSTRAINT "commercial_plan_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "commercial_plan_slug_check" CHECK (length("slug") BETWEEN 3 AND 80 AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_plan_slug_idx" ON "commercial_plans" ("slug");
--> statement-breakpoint
CREATE INDEX "commercial_plan_catalog_idx" ON "commercial_plans" ("status", "scope", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE TABLE "commercial_plan_revisions" (
  "plan_id" text NOT NULL REFERENCES "commercial_plans"("id") ON DELETE RESTRICT,
  "revision" integer NOT NULL, "terms" jsonb NOT NULL, "status" text NOT NULL,
  "action" text NOT NULL, "actor_id" text NOT NULL, "reason" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("plan_id", "revision"),
  CONSTRAINT "commercial_plan_terms_check" CHECK (
    jsonb_typeof("terms") = 'object'
    AND ("terms"->>'durationDays')::integer IN (7, 30, 90, 365)
    AND ("terms"->>'price')::integer BETWEEN 0 AND 100000000
    AND ("terms"->>'currency') IN ('USD', 'EUR', 'RUB')
    AND ("terms"->>'commissionBps')::integer BETWEEN 0 AND 1000
    AND length(btrim("terms"->>'titleRu')) BETWEEN 3 AND 100
    AND length(btrim("terms"->>'titleEn')) BETWEEN 3 AND 100
    AND length(btrim("terms"->>'descriptionRu')) BETWEEN 10 AND 2000
    AND length(btrim("terms"->>'descriptionEn')) BETWEEN 10 AND 2000
    AND jsonb_typeof("terms"->'durationDays') = 'number'
    AND jsonb_typeof("terms"->'price') = 'number'
    AND jsonb_typeof("terms"->'commissionBps') = 'number'
    AND jsonb_typeof("terms"->'currency') = 'string'
    AND jsonb_typeof("terms"->'titleRu') = 'string'
    AND jsonb_typeof("terms"->'titleEn') = 'string'
    AND jsonb_typeof("terms"->'descriptionRu') = 'string'
    AND jsonb_typeof("terms"->'descriptionEn') = 'string'
    AND "terms" ?& ARRAY['durationDays', 'price', 'currency', 'commissionBps', 'titleRu', 'titleEn', 'descriptionRu', 'descriptionEn']
  ),
  CONSTRAINT "commercial_plan_snapshot_check" CHECK ("revision" > 0 AND "status" IN ('draft', 'published', 'archived')
    AND "action" IN ('create', 'save', 'publish', 'archive', 'restore') AND length(btrim("reason")) BETWEEN 5 AND 1000)
);
--> statement-breakpoint
CREATE FUNCTION commercial_plan_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Commercial plan revisions are append-only' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER commercial_plan_revision_immutable BEFORE UPDATE OR DELETE ON "commercial_plan_revisions"
  FOR EACH ROW EXECUTE FUNCTION commercial_plan_revision_immutable();
--> statement-breakpoint
CREATE TABLE "order_cancellation_receipts" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "request_id" text NOT NULL, "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
  "expected_updated_at" timestamptz NOT NULL, "reason" text NOT NULL, "cancelled_at" timestamptz NOT NULL,
  PRIMARY KEY ("user_id", "request_id"),
  CONSTRAINT "order_cancellation_reason_check" CHECK (length(btrim("reason")) BETWEEN 5 AND 1000)
);
--> statement-breakpoint
CREATE INDEX "order_cancellation_order_idx" ON "order_cancellation_receipts" ("order_id");
--> statement-breakpoint
CREATE INDEX "payments_order_created_id_idx" ON "payments" ("order_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "ledger_entries_reference_idx" ON "ledger_entries" ("reference_id", "reference_type");
--> statement-breakpoint
-- All financial reference writers serialize on the order, including direct SQL.
CREATE FUNCTION order_financial_reference_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_order_id text; target_status text; requires_order boolean := true;
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN
    target_order_id := NEW.order_id;
  ELSE
    target_order_id := NEW.reference_id;
    requires_order := NEW.reference_type = 'order';
  END IF;
  SELECT status INTO target_status FROM orders WHERE id = target_order_id FOR NO KEY UPDATE;
  IF target_status IS NULL AND NOT requires_order THEN
    RETURN NEW;
  END IF;
  IF target_status IS NULL OR target_status = 'cancelled' THEN
    RAISE EXCEPTION 'Order does not accept new financial references' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER payment_order_reference_guard BEFORE INSERT OR UPDATE OF order_id ON "payments"
  FOR EACH ROW EXECUTE FUNCTION order_financial_reference_guard();
--> statement-breakpoint
CREATE TRIGGER ledger_order_reference_guard BEFORE INSERT OR UPDATE OF reference_type, reference_id ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION order_financial_reference_guard();
--> statement-breakpoint
CREATE FUNCTION unpaid_order_cancellation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled order cannot be reopened' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    IF OLD.status <> 'pending'
      OR EXISTS (SELECT 1 FROM payments WHERE order_id = OLD.id)
      OR EXISTS (SELECT 1 FROM ledger_entries WHERE reference_id = OLD.id) THEN
      RAISE EXCEPTION 'Order cancellation requires provider reconciliation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER unpaid_order_cancellation_guard BEFORE UPDATE OF status ON "orders"
  FOR EACH ROW EXECUTE FUNCTION unpaid_order_cancellation_guard();
