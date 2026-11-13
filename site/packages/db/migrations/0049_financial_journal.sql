CREATE TABLE "ledger_posting_batches" (
  "id" text PRIMARY KEY, "fingerprint" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(), "created_transaction" text NOT NULL DEFAULT txid_current()::text,
  CONSTRAINT "ledger_batch_fingerprint_check" CHECK ("fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "batch_id" text REFERENCES "ledger_posting_batches"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "ledger_entries_account_currency_time_idx" ON "ledger_entries" ("account_id", "currency", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "ledger_entries_batch_idx" ON "ledger_entries" ("batch_id");
--> statement-breakpoint
CREATE FUNCTION ledger_journal_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Balanced journal records are append-only' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_batch_immutable BEFORE UPDATE OR DELETE ON "ledger_posting_batches"
  FOR EACH ROW EXECUTE FUNCTION ledger_journal_immutable();
--> statement-breakpoint
CREATE FUNCTION ledger_journal_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.batch_id IS NOT NULL THEN
    RAISE EXCEPTION 'Journal entries are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.batch_id IS NOT NULL THEN RAISE EXCEPTION 'Legacy entries cannot enter a journal' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_journal_entry_immutable BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION ledger_journal_entry_guard();
--> statement-breakpoint
CREATE FUNCTION ledger_balance_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE balance bigint;
BEGIN
  -- Runs after ledger_order_reference_guard. Serializes all writers per currency.
  PERFORM pg_advisory_xact_lock(hashtext('ledger-account:' || NEW.account_id || ':' || NEW.currency));
  SELECT coalesce(sum(amount), 0) + NEW.amount INTO balance FROM ledger_entries
    WHERE account_id = NEW.account_id AND currency = NEW.currency;
  IF balance < -2147483648 OR balance > 2147483647 THEN
    RAISE EXCEPTION 'Ledger balance exceeds supported range' USING ERRCODE = '23514';
  END IF;
  NEW.balance_after := balance;
  IF NEW.batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ledger_posting_batches
    WHERE id = NEW.batch_id AND created_transaction = txid_current()::text) THEN
    RAISE EXCEPTION 'Committed journals cannot accept new entries' USING ERRCODE = '23514';
  END IF;
  IF NEW.batch_id IS NOT NULL AND (NEW.amount = 0 OR NEW.currency NOT IN ('USD', 'EUR', 'RUB')
    OR NEW.reference_type NOT IN ('order', 'fee', 'payout', 'refund')
    OR NEW.account_id !~ '^(user|org|platform|escrow):[A-Za-z0-9_-]+$') THEN
    RAISE EXCEPTION 'Invalid journal entry' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_posting_balance_guard BEFORE INSERT ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION ledger_balance_insert_guard();
--> statement-breakpoint
CREATE FUNCTION ledger_batch_balance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE batch text;
BEGIN
  IF TG_TABLE_NAME = 'ledger_posting_batches' THEN batch := NEW.id; ELSE batch := NEW.batch_id; END IF;
  IF batch IS NOT NULL AND (
    (SELECT count(*) FROM ledger_entries WHERE batch_id = batch) NOT BETWEEN 2 AND 100
    OR EXISTS (SELECT 1 FROM ledger_entries WHERE batch_id = batch GROUP BY currency HAVING sum(amount) <> 0)
  ) THEN
    RAISE EXCEPTION 'Journal batch must balance independently in every currency' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ledger_batch_balanced AFTER INSERT ON "ledger_posting_batches"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_batch_balance_guard();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ledger_entry_batch_balanced AFTER INSERT ON "ledger_entries"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_batch_balance_guard();
