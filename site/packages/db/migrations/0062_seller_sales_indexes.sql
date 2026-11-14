CREATE INDEX products_sales_org_id_idx ON products (organization_id, id) WHERE organization_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX order_items_product_order_id_idx ON order_items (product_id, order_id, id);
