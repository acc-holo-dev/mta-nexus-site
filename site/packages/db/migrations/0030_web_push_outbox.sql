CREATE TABLE "web_push_queue_gate" (
  "singleton" boolean PRIMARY KEY DEFAULT true,
  "capacity" integer NOT NULL DEFAULT 10000,
  CONSTRAINT "web_push_queue_gate_singleton" CHECK ("singleton" = true),
  CONSTRAINT "web_push_queue_capacity_bounds" CHECK ("capacity" BETWEEN 1 AND 50000)
);
--> statement-breakpoint
INSERT INTO "web_push_queue_gate" ("singleton", "capacity") VALUES (true, 10000);
--> statement-breakpoint
CREATE TABLE "web_push_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "notification_id" text NOT NULL,
  "subscription_id" text NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "available_at" timestamp with time zone NOT NULL DEFAULT now(),
  "lease_token_digest" text,
  "lease_expires_at" timestamp with time zone,
  "last_status_code" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT "web_push_outbox_notification_fk"
    FOREIGN KEY ("notification_id") REFERENCES "notifications"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "web_push_outbox_subscription_fk"
    FOREIGN KEY ("subscription_id") REFERENCES "web_push_subscriptions"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "web_push_outbox_attempts_bounds"
    CHECK ("attempts" BETWEEN 0 AND 5),
  CONSTRAINT "web_push_outbox_expiry_check"
    CHECK ("expires_at" > "created_at"),
  CONSTRAINT "web_push_outbox_status_bounds"
    CHECK ("last_status_code" IS NULL OR "last_status_code" BETWEEN 100 AND 599)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "web_push_outbox_notification_subscription_idx"
  ON "web_push_outbox" ("notification_id", "subscription_id");
--> statement-breakpoint
CREATE INDEX "web_push_outbox_due_idx"
  ON "web_push_outbox" ("available_at", "id");
--> statement-breakpoint
CREATE INDEX "web_push_outbox_lease_idx"
  ON "web_push_outbox" ("lease_expires_at");
--> statement-breakpoint
CREATE INDEX "web_push_outbox_expiry_idx"
  ON "web_push_outbox" ("expires_at");
