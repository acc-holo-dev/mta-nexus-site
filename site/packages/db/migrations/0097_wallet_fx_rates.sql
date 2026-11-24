-- Recorded exchange pairs. Amounts are minor units of each currency.
-- A rate does not move a balance and is not a market price.

CREATE TABLE wallet_fx_rates (
  id text PRIMARY KEY,
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  base_amount integer NOT NULL,
  quote_amount integer NOT NULL,
  updated_by text NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_fx_rates_id_check CHECK (id ~ '^fxr_[a-f0-9]{24}$'),
  CONSTRAINT wallet_fx_rates_pair_check CHECK (
    base_currency IN ('USD', 'EUR', 'RUB')
    AND quote_currency IN ('USD', 'EUR', 'RUB')
    AND base_currency <> quote_currency
    AND base_amount BETWEEN 1 AND 100000000
    AND quote_amount BETWEEN 1 AND 100000000
  )
);

CREATE UNIQUE INDEX wallet_fx_rates_pair_idx ON wallet_fx_rates (base_currency, quote_currency);
