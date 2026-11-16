-- UX-24: managed advertising placement lifecycle.
-- A slot is reserved inventory; a placement is one booked instance with a time
-- window, an optional impression cap, audience scope and a moderation basis.
-- Capacity, eligibility and pause-with-reason are enforced at serve time.
CREATE TABLE "ad_slots" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "position_key" text NOT NULL,
  "area" text NOT NULL DEFAULT 'any' CHECK ("area" IN ('desktop', 'mobile', 'any')),
  "capacity" integer NOT NULL DEFAULT 1 CHECK ("capacity" >= 1 AND "capacity" <= 100),
  "enabled" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ad_slots_position_key_idx" ON "ad_slots" ("position_key");
--> statement-breakpoint
CREATE TABLE "ad_placements" (
  "id" text PRIMARY KEY,
  "slot_id" text NOT NULL REFERENCES "ad_slots"("id") ON DELETE RESTRICT,
  "advertiser_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "target_type" text NOT NULL CHECK ("target_type" IN ('product', 'server')),
  "target_id" text NOT NULL,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "max_impressions" integer CHECK ("max_impressions" IS NULL OR "max_impressions" > 0),
  "audience" jsonb,
  "moderation_basis" text,
  "status" text NOT NULL DEFAULT 'draft' CHECK (
    "status" IN ('draft', 'pending_approval', 'scheduled', 'live', 'paused', 'ended', 'rejected', 'cancelled')
  ),
  "reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ad_placements_window_check" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "ad_placements_reason_check" CHECK (
    (("status" = 'rejected' OR "status" = 'paused') AND "reason" IS NOT NULL)
    OR ("status" NOT IN ('rejected', 'paused') AND "reason" IS NULL)
  )
);
--> statement-breakpoint
CREATE INDEX "ad_placements_slot_status_window_idx"
  ON "ad_placements" ("slot_id", "status", "starts_at", "ends_at");
--> statement-breakpoint
CREATE INDEX "ad_placements_target_idx"
  ON "ad_placements" ("target_type", "target_id");
