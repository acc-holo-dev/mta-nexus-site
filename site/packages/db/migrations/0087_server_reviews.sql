-- Verified-interaction server reviews (SV-009).
-- Eligibility is enforced in application writes; interaction_source records the evidence class.
CREATE TABLE "server_reviews" (
  "id" text PRIMARY KEY,
  "server_id" text NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
  "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "rating" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'published',
  "revision" integer NOT NULL DEFAULT 1,
  "interaction_source" text NOT NULL,
  "moderation_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz,
  CONSTRAINT "server_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "server_reviews_status_check" CHECK ("status" IN ('published', 'withdrawn', 'removed')),
  CONSTRAINT "server_reviews_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "server_reviews_source_check" CHECK ("interaction_source" IN ('follow')),
  CONSTRAINT "server_reviews_text_check" CHECK (char_length(btrim("text")) BETWEEN 3 AND 4000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "server_reviews_server_author_idx"
  ON "server_reviews" ("server_id", "author_id");
--> statement-breakpoint
CREATE INDEX "server_reviews_public_time_id_idx"
  ON "server_reviews" ("server_id", "created_at" DESC, "id" DESC)
  WHERE "status" = 'published';
--> statement-breakpoint
CREATE INDEX "server_reviews_author_time_id_idx"
  ON "server_reviews" ("author_id", "created_at" DESC, "id" DESC);
