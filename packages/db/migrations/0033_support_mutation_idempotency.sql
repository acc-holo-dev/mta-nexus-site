CREATE TABLE "support_mutation_requests" (
  "actor_id" text NOT NULL,
  "request_key" text NOT NULL,
  "operation" text NOT NULL,
  "fingerprint" text NOT NULL,
  "case_id" text NOT NULL,
  "message_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "support_mutation_requests_actor_request_pk" PRIMARY KEY ("actor_id", "request_key"),
  CONSTRAINT "support_mutation_requests_actor_id_users_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "support_mutation_requests_operation_check"
    CHECK ("operation" IN ('case', 'reply')),
  CONSTRAINT "support_mutation_requests_key_check"
    CHECK (length("request_key") = 36),
  CONSTRAINT "support_mutation_requests_fingerprint_check"
    CHECK (length("fingerprint") = 64)
);
