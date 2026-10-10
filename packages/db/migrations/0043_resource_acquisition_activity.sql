CREATE TABLE "resource_acquisition_events" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL,
  "entitlement_id" text REFERENCES "entitlements"("id") ON DELETE SET NULL,
  "source" text NOT NULL,
  "request_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "resource_acquisition_source_check" CHECK ("source" IN ('direct', 'cart')),
  CONSTRAINT "resource_acquisition_request_check" CHECK (
    ("source" = 'direct' AND "request_id" IS NULL)
    OR ("source" = 'cart' AND "request_id" IS NOT NULL AND length("request_id") BETWEEN 1 AND 128)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "resource_acquisition_entitlement_idx" ON "resource_acquisition_events" ("entitlement_id");
--> statement-breakpoint
CREATE INDEX "resource_acquisition_user_created_idx" ON "resource_acquisition_events" ("user_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "resource_acquisition_product_created_idx" ON "resource_acquisition_events" ("product_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "audit_events_download_activity_idx" ON "audit_events" ("target_id", "created_at" DESC, "id" DESC)
  WHERE "target_type" = 'product' AND "action" = 'product.download_started';
