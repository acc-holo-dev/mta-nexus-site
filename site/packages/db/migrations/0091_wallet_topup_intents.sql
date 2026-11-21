-- NX-015: durable wallet top-up intents for multi-provider stored-value credits.
-- Browser redirects never credit the wallet; only verified provider events do.
-- Live PSP adapters remain unconfigured; stub is a production-shaped port.
CREATE TABLE "wallet_topup_intents" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL,
  "provider_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'created',
  "idempotency_key" text NOT NULL,
  "provider_session_id" text,
  "provider_event_id" text,
  "ledger_batch_id" text REFERENCES "ledger_posting_batches"("id") ON DELETE RESTRICT,
  "return_path" text NOT NULL DEFAULT '/',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "wallet_topup_intents_account_id_check"
    CHECK ("account_id" ~ '^(user|org):[A-Za-z0-9_-]{1,128}$'),
  CONSTRAINT "wallet_topup_intents_amount_check"
    CHECK ("amount" > 0 AND "amount" <= 2147483647),
  CONSTRAINT "wallet_topup_intents_currency_check"
    CHECK ("currency" IN ('USD', 'EUR', 'RUB')),
  CONSTRAINT "wallet_topup_intents_provider_id_check"
    CHECK ("provider_id" IN ('stub', 'stripe', 'yookassa', 'crypto')),
  CONSTRAINT "wallet_topup_intents_status_check"
    CHECK ("status" IN ('created', 'awaiting_provider', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT "wallet_topup_intents_idempotency_key_check"
    CHECK ("idempotency_key" ~ '^[A-Za-z0-9_-]{8,128}$'),
  CONSTRAINT "wallet_topup_intents_succeeded_batch_check"
    CHECK (
      ("status" = 'succeeded' AND "ledger_batch_id" IS NOT NULL AND "provider_event_id" IS NOT NULL)
      OR ("status" <> 'succeeded')
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_topup_intents_idempotency_key_uidx"
  ON "wallet_topup_intents" ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_topup_intents_provider_event_uidx"
  ON "wallet_topup_intents" ("provider_id", "provider_event_id")
  WHERE "provider_event_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "wallet_topup_intents_account_created_idx"
  ON "wallet_topup_intents" ("account_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "wallet_topup_intents_status_provider_idx"
  ON "wallet_topup_intents" ("status", "provider_id");
