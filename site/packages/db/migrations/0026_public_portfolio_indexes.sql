-- Additive indexes for scoped public portfolios and deterministic page ordering.
-- Run in the normal migration transaction during the maintenance window.
CREATE INDEX products_public_author_created_id_idx
  ON products (author_id, created_at DESC, id DESC)
  WHERE status = 'published' AND price = 0;
--> statement-breakpoint
CREATE INDEX products_public_org_created_id_idx
  ON products (organization_id, created_at DESC, id DESC)
  WHERE status = 'published' AND price = 0;
--> statement-breakpoint
CREATE INDEX content_public_org_published_id_idx
  ON content (organization_id, (coalesce(published_at, updated_at)) DESC, id DESC)
  WHERE status = 'published';
