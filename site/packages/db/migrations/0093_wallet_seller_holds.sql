-- NX-015 / ECON-002: seller proceeds hold (7d baseline) after wallet spend.
-- Settlement credits escrow; release moves funds to the seller available balance.
CREATE TABLE "wallet_seller_holds" (
  "id" text PRIMARY KEY,
  "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
  "seller_account_id" text NOT NULL,
  "escrow_account_id" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL,
  "status" text NOT NULL DEFAULT 'held',
  "held_at" timestamptz NOT NULL DEFAULT now(),
  "release_at" timestamptz NOT NULL,
  "hold_ledger_batch_id" text NOT NULL REFERENCES "ledger_posting_batches"("id") ON DELETE RESTRICT,
  "release_ledger_batch_id" text REFERENCES "ledger_posting_batches"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "wallet_seller_holds_seller_account_id_check"
    CHECK ("seller_account_id" ~ '^(user|org):[A-Za-z0-9_-]{1,128}$'),
  CONSTRAINT "wallet_seller_holds_escrow_account_id_check"
    CHECK ("escrow_account_id" ~ '^escrow:[A-Za-z0-9_-]{1,160}$'),
  CONSTRAINT "wallet_seller_holds_amount_check"
    CHECK ("amount" > 0 AND "amount" <= 2147483647),
  CONSTRAINT "wallet_seller_holds_currency_check"
    CHECK ("currency" IN ('USD', 'EUR', 'RUB')),
  CONSTRAINT "wallet_seller_holds_status_check"
    CHECK ("status" IN ('held', 'released', 'cancelled')),
  CONSTRAINT "wallet_seller_holds_released_batch_check"
    CHECK (
      ("status" = 'released' AND "release_ledger_batch_id" IS NOT NULL)
      OR ("status" <> 'released')
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_seller_holds_order_seller_uidx"
  ON "wallet_seller_holds" ("order_id", "seller_account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_seller_holds_escrow_uidx"
  ON "wallet_seller_holds" ("escrow_account_id");
--> statement-breakpoint
CREATE INDEX "wallet_seller_holds_seller_status_idx"
  ON "wallet_seller_holds" ("seller_account_id", "status", "release_at");
--> statement-breakpoint
CREATE INDEX "wallet_seller_holds_matured_idx"
  ON "wallet_seller_holds" ("status", "release_at", "id")
  WHERE "status" = 'held';
