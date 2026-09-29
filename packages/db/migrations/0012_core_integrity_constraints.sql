-- Closed-beta invariants that must hold even when a future caller bypasses
-- route-level validation. Existing invalid data makes this migration fail
-- loudly instead of being silently normalized.

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_check"
  CHECK ("role" IN ('user', 'developer', 'server_owner', 'moderator', 'admin'));

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_role_check"
  CHECK ("role" IN ('owner', 'admin', 'developer', 'member'));

ALTER TABLE "servers"
  ADD CONSTRAINT "servers_status_check"
  CHECK ("status" IN ('active', 'inactive', 'maintenance', 'suspended')),
  ADD CONSTRAINT "servers_visibility_check"
  CHECK ("visibility" IN ('public', 'unlisted', 'private')),
  ADD CONSTRAINT "servers_port_check"
  CHECK ("port" BETWEEN 1 AND 65535),
  ADD CONSTRAINT "servers_http_port_check"
  CHECK ("http_port" IS NULL OR "http_port" BETWEEN 1 AND 65535),
  ADD CONSTRAINT "servers_player_counts_check"
  CHECK (
    ("current_players" IS NULL OR "current_players" >= 0)
    AND ("max_players" IS NULL OR "max_players" >= 0)
    AND ("current_players" IS NULL OR "max_players" IS NULL OR "current_players" <= "max_players")
  );

ALTER TABLE "server_observations"
  ADD CONSTRAINT "server_observations_source_check"
  CHECK ("source" IN ('mta_master', 'mta_query')),
  ADD CONSTRAINT "server_observations_player_counts_check"
  CHECK (
    ("current_players" IS NULL OR "current_players" >= 0)
    AND ("max_players" IS NULL OR "max_players" >= 0)
    AND ("current_players" IS NULL OR "max_players" IS NULL OR "current_players" <= "max_players")
  );

ALTER TABLE "products"
  ADD CONSTRAINT "products_type_check"
  CHECK ("type" IN ('script', 'model', 'vehicle', 'map', 'ui', 'plugin', 'api', 'service', 'bundle')),
  ADD CONSTRAINT "products_status_check"
  CHECK ("status" IN ('draft', 'pending_review', 'published', 'suspended', 'archived')),
  ADD CONSTRAINT "products_price_check"
  CHECK ("price" >= 0),
  ADD CONSTRAINT "products_rating_check"
  CHECK ("rating_average" BETWEEN 0 AND 50 AND "rating_count" >= 0),
  ADD CONSTRAINT "products_sales_count_check"
  CHECK ("sales_count" >= 0);

ALTER TABLE "builds"
  ADD CONSTRAINT "builds_status_check"
  CHECK ("status" IN ('draft', 'testing', 'pending_review', 'published', 'rejected', 'deprecated', 'retired')),
  ADD CONSTRAINT "builds_scan_status_check"
  CHECK ("scan_status" IN ('not_scanned', 'clean', 'malicious', 'error')),
  ADD CONSTRAINT "builds_file_size_check"
  CHECK ("file_size_bytes" > 0),
  ADD CONSTRAINT "builds_sha256_check"
  CHECK (length("sha256_hash") = 64);

ALTER TABLE "entitlements"
  ADD CONSTRAINT "entitlements_subject_type_check"
  CHECK ("subject_type" IN ('user', 'server', 'organization'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "entitlements"
    WHERE "expires_at" IS NULL
    GROUP BY "subject_type", "subject_id", "permission", "resource_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce perpetual entitlement uniqueness: duplicate grants exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "entitlements_perpetual_grant_idx"
  ON "entitlements" ("subject_type", "subject_id", "permission", "resource_id")
  WHERE "expires_at" IS NULL;

ALTER TABLE "content"
  ADD CONSTRAINT "content_type_check"
  CHECK ("type" IN ('article', 'post', 'news', 'devlog', 'update', 'announcement', 'question', 'review')),
  ADD CONSTRAINT "content_status_check"
  CHECK ("status" IN ('draft', 'published', 'archived')),
  ADD CONSTRAINT "content_counters_check"
  CHECK ("view_count" >= 0 AND "like_count" >= 0 AND "comment_count" >= 0);

CREATE UNIQUE INDEX "comments_id_content_idx"
  ON "comments" ("id", "content_id");

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_parent_content_fk"
  FOREIGN KEY ("parent_id", "content_id")
  REFERENCES "comments"("id", "content_id") ON DELETE CASCADE,
  ADD CONSTRAINT "comments_single_target_check"
  CHECK (num_nonnulls("content_id", "product_id") = 1),
  ADD CONSTRAINT "comments_rating_target_check"
  CHECK (
    ("content_id" IS NOT NULL AND "rating" IS NULL)
    OR ("product_id" IS NOT NULL AND "rating" BETWEEN 1 AND 5)
  ),
  ADD CONSTRAINT "comments_parent_target_check"
  CHECK ("parent_id" IS NULL OR "content_id" IS NOT NULL);
