ALTER TABLE order_items ADD COLUMN commercial_snapshot jsonb;
--> statement-breakpoint
CREATE INDEX order_items_recorded_seller_idx ON order_items
  ((commercial_snapshot->'seller'->>'type'),(commercial_snapshot->'seller'->>'id'),order_id,id)
  WHERE commercial_snapshot IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION order_line_terms_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent orders; resource products;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.commercial_snapshot IS NOT NULL THEN
      RAISE EXCEPTION 'Order terms must be recorded by the database' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO parent FROM orders WHERE id = NEW.order_id FOR NO KEY UPDATE;
    IF NOT FOUND OR parent.status = 'cancelled' OR EXISTS (SELECT 1 FROM payments WHERE order_id = parent.id)
      OR EXISTS (SELECT 1 FROM ledger_entries WHERE reference_id = parent.id) THEN
      RAISE EXCEPTION 'Order cannot accept new lines after financial references' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO resource FROM products WHERE id = NEW.product_id FOR SHARE;
    IF NOT FOUND OR length(NEW.currency) NOT BETWEEN 1 AND 16 OR length(resource.license_model) NOT BETWEEN 1 AND 64 THEN
      RAISE EXCEPTION 'Order terms cannot be recorded' USING ERRCODE = '23514';
    END IF;
    NEW.commercial_snapshot := jsonb_build_object(
      'version',1,'recordedAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'product',jsonb_build_object('id',resource.id,'title',left(resource.title,200),'slug',left(resource.slug,200)),
      'seller',jsonb_build_object('type',CASE WHEN resource.organization_id IS NULL THEN 'user' ELSE 'organization' END,
        'id',coalesce(resource.organization_id,resource.author_id)),
      'line',jsonb_build_object('unitPrice',NEW.unit_price,'currency',NEW.currency),
      'baseline',jsonb_build_object('commissionBps',1000,'holdDays',7,'licenseModel',resource.license_model));
    -- Touch the locked parent: a stale REPEATABLE READ economics writer must abort,
    -- rather than miss a newly committed child snapshot in its older snapshot.
    UPDATE orders SET updated_at = greatest(date_trunc('milliseconds',clock_timestamp()),updated_at + interval '1 millisecond')
      WHERE id = parent.id;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.commercial_snapshot IS NOT NULL AND EXISTS (SELECT 1 FROM orders WHERE id = OLD.order_id) THEN
      RAISE EXCEPTION 'Recorded order lines are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.commercial_snapshot IS DISTINCT FROM NEW.commercial_snapshot
    OR (OLD.commercial_snapshot IS NOT NULL AND ROW(NEW.id,NEW.order_id,NEW.product_id,NEW.unit_price,NEW.currency)
      IS DISTINCT FROM ROW(OLD.id,OLD.order_id,OLD.product_id,OLD.unit_price,OLD.currency)) THEN
    RAISE EXCEPTION 'Recorded order terms are immutable; legacy terms cannot be backfilled' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER order_line_terms_guard BEFORE INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION order_line_terms_guard();
--> statement-breakpoint
CREATE FUNCTION order_recorded_economics_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.order_number,NEW.buyer_id,NEW.total_amount,NEW.currency,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.order_number,OLD.buyer_id,OLD.total_amount,OLD.currency,OLD.created_at)
    AND EXISTS (SELECT 1 FROM order_items WHERE order_id = OLD.id AND commercial_snapshot IS NOT NULL) THEN
    RAISE EXCEPTION 'Recorded order economics are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER order_recorded_economics_guard BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION order_recorded_economics_guard();
