-- Staff balance grants are an audited journal kind, not a verified top-up.
-- Domain accepts staff_grant; the insert guard must accept it too.
CREATE OR REPLACE FUNCTION ledger_balance_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
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
    OR NEW.reference_type NOT IN (
      'order', 'fee', 'payout', 'refund',
      'topup', 'wallet_spend', 'withdrawal', 'wallet_hold',
      'staff_grant'
    )
    OR NEW.account_id !~ '^(user|org|platform|escrow):[A-Za-z0-9_-]+$') THEN
    RAISE EXCEPTION 'Invalid journal entry' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
