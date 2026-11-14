CREATE INDEX "support_cases_updated_id_idx"
  ON "support_cases" USING btree ("updated_at","id");
