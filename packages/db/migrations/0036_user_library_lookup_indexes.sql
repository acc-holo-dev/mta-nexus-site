CREATE INDEX "entitlements_user_download_library_idx"
  ON "entitlements" USING btree
  ("subject_id","resource_id","expires_at","created_at")
  WHERE "subject_type" = 'user' AND "permission" = 'product.download';
--> statement-breakpoint
CREATE INDEX "licenses_user_active_library_idx"
  ON "licenses" USING btree
  ("user_id","product_id","expires_at","created_at")
  WHERE "status" = 'active';
