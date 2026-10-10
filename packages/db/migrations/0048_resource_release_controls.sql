CREATE TABLE "resource_library_selections" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "mode" text NOT NULL, "build_id" text, "revision" integer NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "product_id"),
  CONSTRAINT "resource_library_selection_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "resource_library_selection_mode_check" CHECK (
    ("mode" = 'latest' AND "build_id" IS NULL) OR
    ("mode" = 'fixed' AND "build_id" IS NOT NULL AND length("build_id") BETWEEN 1 AND 128 AND "build_id" ~ '^[A-Za-z0-9_-]+$')
  )
);
--> statement-breakpoint
CREATE INDEX "products_moderation_status_updated_id_idx" ON "products" ("status", "updated_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "products_moderation_updated_id_idx" ON "products" ("updated_at" DESC, "id" DESC);
