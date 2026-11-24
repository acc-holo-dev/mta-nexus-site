-- Platform-funded promo codes. Catalog line prices stay unchanged.
-- The charged order total is the list minus a recorded discount.
-- platform:promo funds that gap with reference type fee, which the journal guard already allows.

ALTER TABLE orders
  ADD COLUMN list_amount integer,
  ADD COLUMN discount_amount integer,
  ADD COLUMN promo_code text;

ALTER TABLE orders ADD CONSTRAINT orders_promo_truth_check CHECK (
  (list_amount IS NULL AND discount_amount IS NULL AND promo_code IS NULL)
  OR (
    list_amount BETWEEN 2 AND 100000000
    AND discount_amount BETWEEN 1 AND 100000000
    AND discount_amount < list_amount
    AND total_amount = list_amount - discount_amount
    AND total_amount >= 1
    AND promo_code ~ '^[A-Z0-9]{4,16}$'
  )
);

CREATE TABLE promo_codes (
  id text PRIMARY KEY,
  code text NOT NULL,
  kind text NOT NULL,
  percent integer,
  amount integer,
  currency text,
  active boolean NOT NULL DEFAULT true,
  max_redemptions integer,
  redemption_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by text NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_id_check CHECK (id ~ '^prm_[a-f0-9]{24}$'),
  CONSTRAINT promo_codes_code_check CHECK (code ~ '^[A-Z0-9]{4,16}$'),
  CONSTRAINT promo_codes_kind_check CHECK (
    (
      kind = 'percent'
      AND percent BETWEEN 1 AND 90
      AND amount IS NULL
      AND currency IS NULL
    ) OR (
      kind = 'fixed'
      AND amount BETWEEN 1 AND 100000000
      AND currency IN ('USD', 'EUR', 'RUB')
      AND percent IS NULL
    )
  ),
  CONSTRAINT promo_codes_count_check CHECK (
    redemption_count >= 0 AND (
      max_redemptions IS NULL
      OR (max_redemptions BETWEEN 1 AND 100000 AND redemption_count <= max_redemptions)
    )
  ),
  CONSTRAINT promo_codes_window_check CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at
  )
);

CREATE UNIQUE INDEX promo_codes_code_idx ON promo_codes (code);

CREATE TABLE promo_redemptions (
  order_id text PRIMARY KEY REFERENCES orders (id) ON DELETE RESTRICT,
  code text NOT NULL,
  buyer_id text NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  list_amount integer NOT NULL,
  discount_amount integer NOT NULL,
  charged_amount integer NOT NULL,
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_redemptions_code_check CHECK (code ~ '^[A-Z0-9]{4,16}$'),
  CONSTRAINT promo_redemptions_amounts_check CHECK (
    list_amount BETWEEN 2 AND 100000000
    AND discount_amount BETWEEN 1 AND 100000000
    AND discount_amount < list_amount
    AND charged_amount = list_amount - discount_amount
    AND currency IN ('USD', 'EUR', 'RUB')
  )
);

CREATE UNIQUE INDEX promo_redemptions_buyer_code_idx ON promo_redemptions (buyer_id, code);
