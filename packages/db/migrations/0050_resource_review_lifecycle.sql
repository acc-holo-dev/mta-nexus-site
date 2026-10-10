-- Existing reviews keep their text and rating. No historical acquisition is inferred.
ALTER TABLE comments ADD COLUMN review_status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE comments ADD COLUMN review_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE comments ADD COLUMN review_updated_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN review_access_source TEXT;
ALTER TABLE comments ADD COLUMN review_moderation_reason TEXT;
ALTER TABLE comments ADD CONSTRAINT comments_review_status_check CHECK (review_status IN ('published', 'withdrawn', 'removed'));
ALTER TABLE comments ADD CONSTRAINT comments_review_revision_check CHECK (review_revision > 0);
ALTER TABLE comments ADD CONSTRAINT comments_review_source_check CHECK (review_access_source IS NULL OR review_access_source IN ('entitlement', 'license'));
-- NOT VALID preserves historical malformed rows, while rejecting new malformed product reviews.
ALTER TABLE comments ADD CONSTRAINT comments_review_target_check CHECK (product_id IS NULL OR
  (content_id IS NULL AND parent_id IS NULL AND
    (review_status <> 'published' OR (rating BETWEEN 1 AND 5 AND rating IS NOT NULL)))) NOT VALID;
CREATE INDEX comments_product_public_time_id_idx ON comments(product_id, created_at DESC, id DESC)
  WHERE product_id IS NOT NULL AND content_id IS NULL AND review_status = 'published';
CREATE INDEX comments_review_author_time_id_idx ON comments(author_id, created_at DESC, id DESC)
  WHERE product_id IS NOT NULL AND content_id IS NULL;
CREATE INDEX reports_review_queue_idx ON reports(status, created_at, id) WHERE target_type = 'review';
-- Agent B's private verification history contract.
CREATE INDEX verification_requests_requester_created_id_idx ON verification_requests(requester_id, created_at DESC, id DESC);
