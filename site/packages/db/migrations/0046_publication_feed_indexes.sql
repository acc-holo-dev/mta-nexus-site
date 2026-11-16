CREATE INDEX "content_public_feed_time_id_idx" ON "content" ((coalesce("published_at", "created_at")) DESC, "id" DESC) WHERE "status" = 'published';
--> statement-breakpoint
CREATE INDEX "content_public_author_feed_time_id_idx" ON "content" ("author_id", (coalesce("published_at", "created_at")) DESC, "id" DESC) WHERE "status" = 'published';
--> statement-breakpoint
CREATE INDEX "content_public_org_feed_time_id_idx" ON "content" ("organization_id", (coalesce("published_at", "created_at")) DESC, "id" DESC) WHERE "status" = 'published';
