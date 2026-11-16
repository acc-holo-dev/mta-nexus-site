-- Additive D1 primitives only. Do not infer mailbox ownership from legacy flags.
-- No updates to existing users, password hashes, email flags or sessions.
CREATE TABLE "account_auth_state" (
  "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "credential_version" integer NOT NULL DEFAULT 0,
  CONSTRAINT "account_auth_version_nonnegative" CHECK ("credential_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "auth_challenges" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "purpose" text NOT NULL,
  "token_digest" text NOT NULL,
  "email" text NOT NULL,
  "credential_version" integer NOT NULL,
  "binding_id" text,
  "initiating_session_digest" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "revoked_at" timestamptz,
  CONSTRAINT "auth_challenge_purpose_check" CHECK ("purpose" IN ('email_verify', 'password_reset')),
  CONSTRAINT "auth_challenge_digest_check" CHECK ("token_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "auth_challenge_version_check" CHECK ("credential_version" >= 0),
  CONSTRAINT "auth_challenge_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "auth_challenge_terminal_check" CHECK (NOT ("consumed_at" IS NOT NULL AND "revoked_at" IS NOT NULL)),
  CONSTRAINT "auth_challenge_context_check" CHECK (
    ("purpose" = 'email_verify' AND "binding_id" IS NULL AND "initiating_session_digest" IS NOT NULL
      AND "initiating_session_digest" ~ '^[0-9a-f]{64}$')
    OR ("purpose" = 'password_reset' AND "binding_id" IS NOT NULL AND "initiating_session_digest" IS NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_challenge_digest_unique" ON "auth_challenges" ("token_digest");
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_challenge_pending_unique" ON "auth_challenges" ("user_id", "purpose")
  WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "auth_challenge_expiry_idx" ON "auth_challenges" ("expires_at");
--> statement-breakpoint
CREATE TABLE "account_recovery_bindings" (
  "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "id" text NOT NULL UNIQUE,
  "verified_email" text NOT NULL,
  "verified_at" timestamptz NOT NULL DEFAULT now(),
  "proof_version" integer NOT NULL,
  "proof_challenge_id" text NOT NULL REFERENCES "auth_challenges"("id") ON DELETE CASCADE,
  CONSTRAINT "account_recovery_proof_version_check" CHECK ("proof_version" = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_recovery_proof_unique" ON "account_recovery_bindings" ("proof_challenge_id");
--> statement-breakpoint
-- Cover every SQL password/email writer, not just one service method. A generic
-- profile update must not keep an old proof valid after credentials change.
-- Invoker privileges; no dynamic SQL or SECURITY DEFINER privilege escalation.
CREATE FUNCTION nexus_invalidate_recovery_proofs() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  INSERT INTO account_auth_state (user_id, credential_version) VALUES (NEW.id, 1)
    ON CONFLICT (user_id) DO UPDATE
      SET credential_version = account_auth_state.credential_version + 1;
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    DELETE FROM account_recovery_bindings WHERE user_id = NEW.id;
  END IF;
  UPDATE auth_challenges SET revoked_at = clock_timestamp()
    WHERE user_id = NEW.id AND consumed_at IS NULL AND revoked_at IS NULL;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER nexus_credentials_invalidate_recovery
AFTER UPDATE OF password_hash, email ON users
FOR EACH ROW
WHEN (OLD.password_hash IS DISTINCT FROM NEW.password_hash OR OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION nexus_invalidate_recovery_proofs();
