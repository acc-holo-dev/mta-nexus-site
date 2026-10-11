CREATE TABLE commerce_order_cases (
  case_id text PRIMARY KEY REFERENCES support_cases(id) ON DELETE RESTRICT,
  order_id text NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('payment_issue','resource_issue','refund_request','dispute')),
  review_status text NOT NULL DEFAULT 'intake' CHECK (review_status IN
    ('intake','reviewing','awaiting_buyer','refund_recommended','refund_declined','resolved','dismissed')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  requested_amount integer CHECK (requested_amount > 0),
  currency text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_order_cases_amount_kind_check CHECK (
    (kind = 'refund_request' AND requested_amount IS NOT NULL) OR kind = 'dispute'
    OR (kind IN ('payment_issue','resource_issue') AND requested_amount IS NULL)),
  CONSTRAINT commerce_order_cases_snapshot_check CHECK (
    coalesce(jsonb_typeof(snapshot) = 'object' AND snapshot->>'confirmation' = 'recorded_only'
    AND jsonb_typeof(snapshot->'payments') = 'array' AND jsonb_array_length(snapshot->'payments') <= 20, false))
);
--> statement-breakpoint
CREATE INDEX commerce_order_cases_review_time_id_idx ON commerce_order_cases (review_status, created_at, case_id);
--> statement-breakpoint
CREATE FUNCTION nexus_order_case_context_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent orders%ROWTYPE;
  ticket support_cases%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.case_id, NEW.order_id, NEW.kind, NEW.requested_amount, NEW.currency, NEW.snapshot, NEW.created_at)
      IS DISTINCT FROM ROW(OLD.case_id, OLD.order_id, OLD.kind, OLD.requested_amount, OLD.currency, OLD.snapshot, OLD.created_at) THEN
      RAISE EXCEPTION 'Purchase case context is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
      IF OLD.revision = 2147483647 THEN RAISE EXCEPTION 'Case revision exhausted' USING ERRCODE = '23514'; END IF;
      NEW.revision := OLD.revision + 1;
    ELSE NEW.revision := OLD.revision; END IF;
    RETURN NEW;
  END IF;
  IF NEW.revision <> 1 OR NEW.review_status <> 'intake' THEN
    RAISE EXCEPTION 'Purchase case begins at intake' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO parent FROM orders WHERE id = NEW.order_id FOR NO KEY UPDATE;
  SELECT * INTO ticket FROM support_cases WHERE id = NEW.case_id;
  IF parent.id IS NULL OR ticket.id IS NULL OR ticket.requester_id <> parent.buyer_id
    OR ticket.related_type IS DISTINCT FROM 'purchase' OR ticket.related_id IS DISTINCT FROM parent.id
    OR NEW.currency IS DISTINCT FROM parent.currency
    OR NEW.snapshot->>'orderId' IS DISTINCT FROM parent.id
    OR NEW.snapshot->>'orderNumber' IS DISTINCT FROM parent.order_number
    OR NEW.snapshot->>'orderStatus' IS DISTINCT FROM parent.status
    OR NEW.snapshot->>'currency' IS DISTINCT FROM parent.currency
    OR NEW.snapshot->>'totalAmount' IS DISTINCT FROM parent.total_amount::text
    OR (NEW.requested_amount IS NOT NULL AND NEW.requested_amount > parent.total_amount) THEN
    RAISE EXCEPTION 'Purchase case must belong to the buyer and recorded order' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER commerce_order_cases_context_guard BEFORE INSERT OR UPDATE ON commerce_order_cases
  FOR EACH ROW EXECUTE FUNCTION nexus_order_case_context_guard();
--> statement-breakpoint
-- Protect commercial associations even when the shared support lifecycle is used.
CREATE FUNCTION nexus_order_case_support_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id, NEW.requester_id, NEW.related_type, NEW.related_id)
    IS DISTINCT FROM ROW(OLD.id, OLD.requester_id, OLD.related_type, OLD.related_id)
    AND EXISTS (SELECT 1 FROM commerce_order_cases WHERE case_id = OLD.id) THEN
    RAISE EXCEPTION 'Purchase support association is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER support_cases_commerce_association_guard BEFORE UPDATE ON support_cases
  FOR EACH ROW EXECUTE FUNCTION nexus_order_case_support_guard();
