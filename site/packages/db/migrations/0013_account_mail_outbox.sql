-- D2a: storage only. No SMTP worker, provider keys or public recovery endpoints.
CREATE TABLE "account_mail_queue_gate" (
  "singleton" boolean PRIMARY KEY DEFAULT true,
  "capacity" integer NOT NULL DEFAULT 1000,
  CONSTRAINT "account_mail_gate_singleton" CHECK ("singleton" = true),
  CONSTRAINT "account_mail_capacity_bounds" CHECK ("capacity" BETWEEN 1 AND 1000)
);
--> statement-breakpoint
INSERT INTO "account_mail_queue_gate" ("singleton", "capacity") VALUES (true, 1000);
--> statement-breakpoint
CREATE TABLE "account_mail_outbox" (
  "id" text PRIMARY KEY,
  "challenge_id" text NOT NULL UNIQUE REFERENCES "auth_challenges"("id") ON DELETE CASCADE,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  CONSTRAINT "account_mail_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "account_mail_payload_bounds" CHECK (
    jsonb_typeof("payload") = 'object' AND octet_length("payload"::text) BETWEEN 1 AND 2048)
);
--> statement-breakpoint
CREATE INDEX "account_mail_expiry_idx" ON "account_mail_outbox" ("expires_at");
--> statement-breakpoint
-- Deletion erases the live queued ciphertext on use/reissue/credential change.
-- It does not erase copies in WAL/backups or retract a previously delivered mail.
-- No queue-gate lock here: producer order is user -> challenge -> queue gate;
-- cleanup must not acquire that gate and then wait for another producer's rows.
CREATE FUNCTION nexus_discard_terminal_account_mail() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  DELETE FROM account_mail_outbox WHERE challenge_id = NEW.id;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER nexus_challenge_discards_mail
AFTER UPDATE OF consumed_at, revoked_at ON auth_challenges
FOR EACH ROW
WHEN (NEW.consumed_at IS NOT NULL OR NEW.revoked_at IS NOT NULL)
EXECUTE FUNCTION nexus_discard_terminal_account_mail();
