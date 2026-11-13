CREATE TABLE "support_cases" (
  "id" text PRIMARY KEY NOT NULL,
  "requester_id" text NOT NULL,
  "category" text NOT NULL,
  "subject" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "related_type" text,
  "related_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "support_cases_requester_id_users_id_fk"
    FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "support_cases_category_check"
    CHECK ("category" IN ('account','resource','server','purchase','license','payment','seller','integration','other')),
  CONSTRAINT "support_cases_status_check"
    CHECK ("status" IN ('open','resolved','closed')),
  CONSTRAINT "support_cases_related_type_check"
    CHECK ("related_type" IS NULL OR "related_type" IN ('product','server','purchase','license','seller')),
  CONSTRAINT "support_cases_related_pair_check"
    CHECK (
      ("related_type" IS NULL AND "related_id" IS NULL)
      OR
      ("related_type" IS NOT NULL AND "related_id" IS NOT NULL)
    )
);
--> statement-breakpoint
CREATE INDEX "support_cases_requester_updated_id_idx"
  ON "support_cases" USING btree ("requester_id","updated_at","id");
--> statement-breakpoint
CREATE INDEX "support_cases_status_updated_id_idx"
  ON "support_cases" USING btree ("status","updated_at","id");
--> statement-breakpoint
CREATE TABLE "support_case_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "case_id" text NOT NULL,
  "author_id" text,
  "author_role" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "support_case_messages_case_id_support_cases_id_fk"
    FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "support_case_messages_author_id_users_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action,
  CONSTRAINT "support_case_messages_author_role_check"
    CHECK ("author_role" IN ('requester','staff'))
);
--> statement-breakpoint
CREATE INDEX "support_case_messages_case_created_id_idx"
  ON "support_case_messages" USING btree ("case_id","created_at","id");
