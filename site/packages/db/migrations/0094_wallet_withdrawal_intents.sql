-- NX-015: durable wallet withdrawal intents.
-- Available balance is held in escrow on start; verified payout events settle or refund.
-- Live payout adapters remain unconfigured; stub is a production-shaped port.
-- HTTP stays dark unless NEXUS_WALLET_ENGINE=1 and NEXUS_WALLET_WITHDRAW=1.
CREATE TABLE "wallet_withdrawal_intents" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL,
  "provider_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'created',
  "idempotency_key" text NOT NULL,
  "provider_session_id" text,
  "provider_event_id" text,
  "escrow_account_id" text NOT NULL,
  "hold_ledger_batch_id" text REFERENCES "ledger_posting_batches"("id") ON DELETE RESTRICT,
  "settle_ledger_batch_id" text REFERENCES "ledger_posting_batches"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "wallet_withdrawal_intents_account_id_check"
    CHECK ("account_id" ~ '^(user|org):[A-Za-z0-9_-]{1,128}$'),
  CONSTRAINT "wallet_withdrawal_intents_amount_check"
    CHECK ("amount" > 0 AND "amount" <= 2147483647),
  CONSTRAINT "wallet_withdrawal_intents_currency_check"
    CHECK ("currency" IN ('USD', 'EUR', 'RUB')),
  CONSTRAINT "wallet_withdrawal_intents_provider_id_check"
    CHECK ("provider_id" IN ('stub', 'stripe', 'yookassa', 'crypto')),
  CONSTRAINT "wallet_withdrawal_intents_status_check"
    CHECK ("status" IN ('created', 'awaiting_provider', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT "wallet_withdrawal_intents_idempotency_key_check"
    CHECK ("idempotency_key" ~ '^[A-Za-z0-9_-]{8,128}$'),
  CONSTRAINT "wallet_withdrawal_intents_escrow_account_id_check"
    CHECK ("escrow_account_id" ~ '^escrow:[A-Za-z0-9_-]{1,160}$'),
  CONSTRAINT "wallet_withdrawal_intents_awaiting_hold_check"
    CHECK (
      ("status" = 'awaiting_provider' AND "hold_ledger_batch_id" IS NOT NULL AND "provider_session_id" IS NOT NULL)
      OR ("status" <> 'awaiting_provider')
    ),
  CONSTRAINT "wallet_withdrawal_intents_succeeded_settle_check"
    CHECK (
      ("status" = 'succeeded' AND "settle_ledger_batch_id" IS NOT NULL AND "provider_event_id" IS NOT NULL AND "hold_ledger_batch_id" IS NOT NULL)
      OR ("status" <> 'succeeded')
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_withdrawal_intents_idempotency_key_uidx"
  ON "wallet_withdrawal_intents" ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_withdrawal_intents_provider_event_uidx"
  ON "wallet_withdrawal_intents" ("provider_id", "provider_event_id")
  WHERE "provider_event_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_withdrawal_intents_escrow_uidx"
  ON "wallet_withdrawal_intents" ("escrow_account_id");
--> statement-breakpoint
CREATE INDEX "wallet_withdrawal_intents_account_created_idx"
  ON "wallet_withdrawal_intents" ("account_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "wallet_withdrawal_intents_status_provider_idx"
  ON "wallet_withdrawal_intents" ("status", "provider_id");
