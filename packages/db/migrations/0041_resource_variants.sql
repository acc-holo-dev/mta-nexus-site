CREATE TABLE "product_variant_groups" (
  "id" text PRIMARY KEY,
  "anchor_product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "product_variant_title_check" CHECK (length(btrim("title")) BETWEEN 3 AND 80),
  CONSTRAINT "product_variant_revision_check" CHECK ("revision" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_anchor_idx" ON "product_variant_groups" ("anchor_product_id");
--> statement-breakpoint
CREATE TABLE "product_variant_members" (
  "product_id" text PRIMARY KEY REFERENCES "products"("id") ON DELETE CASCADE,
  "group_id" text NOT NULL REFERENCES "product_variant_groups"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "position" integer NOT NULL,
  CONSTRAINT "product_variant_label_check" CHECK (length(btrim("label")) BETWEEN 1 AND 60),
  CONSTRAINT "product_variant_position_check" CHECK ("position" BETWEEN 0 AND 11)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_position_idx" ON "product_variant_members" ("group_id", "position");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_label_idx" ON "product_variant_members" ("group_id", lower(btrim("label")));
