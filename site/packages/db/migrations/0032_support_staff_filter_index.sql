CREATE INDEX "support_cases_category_status_updated_id_idx"
  ON "support_cases" USING btree ("category","status","updated_at","id");
