CREATE TABLE "web_push_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "session_id" text NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "expiration_at" timestamp with time zone,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "web_push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "web_push_subscriptions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "web_push_subscriptions_endpoint_idx" ON "web_push_subscriptions" USING btree ("endpoint");
--> statement-breakpoint
CREATE INDEX "web_push_subscriptions_user_idx" ON "web_push_subscriptions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "web_push_subscriptions_session_idx" ON "web_push_subscriptions" USING btree ("session_id");
