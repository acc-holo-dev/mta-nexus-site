ALTER TABLE resource_cart_acquisitions ADD COLUMN review_digest text;
--> statement-breakpoint
ALTER TABLE resource_cart_acquisitions ADD COLUMN review_snapshot jsonb;
--> statement-breakpoint
ALTER TABLE resource_cart_acquisitions ADD CONSTRAINT resource_cart_review_digest_check
  CHECK ((review_digest IS NULL AND review_snapshot IS NULL) OR
    (review_digest IS NOT NULL AND review_digest ~ '^[a-f0-9]{64}$' AND review_snapshot IS NOT NULL AND
      CASE WHEN jsonb_typeof(review_snapshot) = 'array' THEN jsonb_array_length(review_snapshot) BETWEEN 1 AND 20 ELSE false END));
--> statement-breakpoint
CREATE INDEX resource_cart_receipt_user_time_idx ON resource_cart_acquisitions(user_id, created_at DESC, request_id DESC);
--> statement-breakpoint
CREATE FUNCTION nexus_resource_cart_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Resource cart receipts are immutable' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
    RAISE EXCEPTION 'Cart receipts can only be removed with their account' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER resource_cart_acquisitions_guard BEFORE UPDATE OR DELETE ON resource_cart_acquisitions
  FOR EACH ROW EXECUTE FUNCTION nexus_resource_cart_receipt_guard();
