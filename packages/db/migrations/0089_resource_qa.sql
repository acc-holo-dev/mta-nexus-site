-- FLOW-12: public resource Q&A threads (separate from reviews, release watches, and private support).
CREATE TABLE "resource_qa_threads" (
  "id" text PRIMARY KEY,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "revision" integer NOT NULL DEFAULT 1,
  "build_id" text REFERENCES "builds"("id") ON DELETE SET NULL,
  "build_version_label" text,
  "resolved_answer_id" text,
  "resolved_at" timestamptz,
  "resolved_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz,
  CONSTRAINT "resource_qa_threads_status_check" CHECK ("status" IN ('open', 'resolved', 'removed')),
  CONSTRAINT "resource_qa_threads_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "resource_qa_threads_body_check" CHECK (char_length(btrim("body")) BETWEEN 3 AND 4000),
  CONSTRAINT "resource_qa_threads_build_label_check" CHECK (
    ("build_id" IS NULL AND "build_version_label" IS NULL)
    OR (
      "build_version_label" IS NOT NULL
      AND char_length(btrim("build_version_label")) BETWEEN 1 AND 64
    )
  ),
  CONSTRAINT "resource_qa_threads_resolved_check" CHECK (
    ("status" = 'resolved' AND "resolved_answer_id" IS NOT NULL AND "resolved_at" IS NOT NULL AND "resolved_by" IS NOT NULL)
    OR ("status" <> 'resolved' AND "resolved_answer_id" IS NULL AND "resolved_at" IS NULL AND "resolved_by" IS NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "resource_qa_answers" (
  "id" text PRIMARY KEY,
  "thread_id" text NOT NULL REFERENCES "resource_qa_threads"("id") ON DELETE CASCADE,
  "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'published',
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz,
  CONSTRAINT "resource_qa_answers_status_check" CHECK ("status" IN ('published', 'removed')),
  CONSTRAINT "resource_qa_answers_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "resource_qa_answers_body_check" CHECK (char_length(btrim("body")) BETWEEN 3 AND 4000)
);
--> statement-breakpoint
ALTER TABLE "resource_qa_threads"
  ADD CONSTRAINT "resource_qa_threads_resolved_answer_fk"
  FOREIGN KEY ("resolved_answer_id") REFERENCES "resource_qa_answers"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TABLE "resource_qa_thread_follows" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "thread_id" text NOT NULL REFERENCES "resource_qa_threads"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "revision" integer NOT NULL DEFAULT 1,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "resource_qa_thread_follows_pk" PRIMARY KEY ("user_id", "thread_id"),
  CONSTRAINT "resource_qa_thread_follows_revision_check" CHECK ("revision" > 0)
);
--> statement-breakpoint
CREATE INDEX "resource_qa_threads_product_public_time_id_idx"
  ON "resource_qa_threads" ("product_id", "created_at" DESC, "id" DESC)
  WHERE "status" IN ('open', 'resolved');
--> statement-breakpoint
CREATE INDEX "resource_qa_threads_author_time_id_idx"
  ON "resource_qa_threads" ("author_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "resource_qa_answers_thread_time_id_idx"
  ON "resource_qa_answers" ("thread_id", "created_at" ASC, "id" ASC)
  WHERE "status" = 'published';
--> statement-breakpoint
CREATE INDEX "resource_qa_thread_follows_thread_enabled_idx"
  ON "resource_qa_thread_follows" ("thread_id")
  WHERE "enabled" = true;
