CREATE UNIQUE INDEX "server_installations_one_active_per_server_idx"
  ON "server_installations" USING btree ("server_id")
  WHERE "status" = 'active';
