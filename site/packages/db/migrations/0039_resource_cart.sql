CREATE TABLE "resource_cart_items" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "product_id")
);
--> statement-breakpoint
CREATE TABLE "resource_cart_acquisitions" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "request_id" text NOT NULL,
  "product_ids" jsonb NOT NULL,
  "result" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "request_id")
);
--> statement-breakpoint
CREATE INDEX "order_items_order_id_item_id_idx" ON "order_items" ("order_id", "id");
