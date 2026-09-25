CREATE TABLE "account_mail_delivery_events" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "purpose" text,
  "outcome" text NOT NULL,
  "attempt" integer NOT NULL,
  "smtp_stage" text,
  "smtp_code" integer,
  "uncertain" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "account_mail_delivery_message_id_check" CHECK ("message_id" ~ '^ame_[A-Za-z0-9_-]+$'),
  CONSTRAINT "account_mail_delivery_purpose_check" CHECK ("purpose" is null or "purpose" in ('email_verify', 'password_reset')),
  CONSTRAINT "account_mail_delivery_outcome_check" CHECK ("outcome" in ('accepted','retry','discard','provider_deferred','expired','attempts_exhausted')),
  CONSTRAINT "account_mail_delivery_attempt_check" CHECK ("attempt" between 0 and 5),
  CONSTRAINT "account_mail_delivery_stage_check" CHECK ("smtp_stage" is null or "smtp_stage" in ('connect','greeting','ehlo','starttls','auth','mail_from','rcpt_to','data','final_reply')),
  CONSTRAINT "account_mail_delivery_code_check" CHECK ("smtp_code" is null or "smtp_code" between 200 and 599),
  CONSTRAINT "account_mail_delivery_expiry_check" CHECK ("expires_at" > "created_at")
);
--> statement-breakpoint
CREATE INDEX "account_mail_delivery_message_idx" ON "account_mail_delivery_events" USING btree ("message_id","created_at");
--> statement-breakpoint
CREATE INDEX "account_mail_delivery_expiry_idx" ON "account_mail_delivery_events" USING btree ("expires_at");
