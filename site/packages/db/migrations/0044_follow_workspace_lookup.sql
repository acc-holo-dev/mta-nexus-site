CREATE INDEX "follows_follower_created_id_idx" ON "follows" ("follower_id", "created_at" DESC, "id" DESC);
