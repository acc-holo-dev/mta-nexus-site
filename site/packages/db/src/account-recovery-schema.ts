import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./schema";

// Private recovery state: deliberately not part of the public User shape.
// The SQL migration owns the credential-change trigger; keep it on future upgrades.
export const accountAuthState = pgTable(
  "account_auth_state",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialVersion: integer("credential_version").notNull().default(0),
  },
  (t) => [check("account_auth_version_nonnegative", sql`${t.credentialVersion} >= 0`)],
);

export const authChallenges = pgTable(
  "auth_challenges",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose", { enum: ["email_verify", "password_reset"] }).notNull(),
    tokenDigest: text("token_digest").notNull(),
    email: text("email").notNull(),
    credentialVersion: integer("credential_version").notNull(),
    bindingId: text("binding_id"),
    initiatingSessionDigest: text("initiating_session_digest"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("auth_challenge_digest_unique").on(t.tokenDigest),
    uniqueIndex("auth_challenge_pending_unique")
      .on(t.userId, t.purpose)
      .where(sql`${t.consumedAt} is null and ${t.revokedAt} is null`),
    index("auth_challenge_expiry_idx").on(t.expiresAt),
    check("auth_challenge_purpose_check", sql`${t.purpose} in ('email_verify', 'password_reset')`),
    check("auth_challenge_digest_check", sql`${t.tokenDigest} ~ '^[0-9a-f]{64}$'`),
    check("auth_challenge_version_check", sql`${t.credentialVersion} >= 0`),
    check("auth_challenge_expiry_check", sql`${t.expiresAt} > ${t.createdAt}`),
    check(
      "auth_challenge_terminal_check",
      sql`not (${t.consumedAt} is not null and ${t.revokedAt} is not null)`,
    ),
    check(
      "auth_challenge_context_check",
      sql`
    (${t.purpose} = 'email_verify' and ${t.bindingId} is null
      and ${t.initiatingSessionDigest} is not null and ${t.initiatingSessionDigest} ~ '^[0-9a-f]{64}$')
    or (${t.purpose} = 'password_reset' and ${t.bindingId} is not null and ${t.initiatingSessionDigest} is null)`,
    ),
  ],
);

export const accountRecoveryBindings = pgTable(
  "account_recovery_bindings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    id: text("id").notNull().unique(),
    verifiedEmail: text("verified_email").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
    proofVersion: integer("proof_version").notNull(),
    proofChallengeId: text("proof_challenge_id")
      .notNull()
      .references(() => authChallenges.id, { onDelete: "cascade" }),
  },
  (t) => [
    check("account_recovery_proof_version_check", sql`${t.proofVersion} = 1`),
    uniqueIndex("account_recovery_proof_unique").on(t.proofChallengeId),
  ],
);
