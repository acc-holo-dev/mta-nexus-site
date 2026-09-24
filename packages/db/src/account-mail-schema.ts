import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { authChallenges } from "./account-recovery-schema";
import type { SealedMail } from "./repositories/account-mail-crypto";

// Internal pending/leased mail only. Not exported from the public database barrel.
export const accountMailQueueGate = pgTable("account_mail_queue_gate", {
  singleton: boolean("singleton").primaryKey().default(true),
  capacity: integer("capacity").notNull().default(1000),
}, (t) => [
  check("account_mail_gate_singleton", sql`${t.singleton} = true`),
  check("account_mail_capacity_bounds", sql`${t.capacity} between 1 and 1000`),
]);

export const accountMailOutbox = pgTable("account_mail_outbox", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id").notNull().unique()
    .references(() => authChallenges.id, { onDelete: "cascade" }),
  payload: jsonb("payload").$type<SealedMail>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  leaseTokenDigest: text("lease_token_digest"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
}, (t) => [
  index("account_mail_expiry_idx").on(t.expiresAt),
  index("account_mail_available_idx").on(t.availableAt, t.id),
  check("account_mail_expiry_check", sql`${t.expiresAt} > ${t.createdAt}`),
  check("account_mail_attempts_check", sql`${t.attempts} between 0 and 5`),
  check("account_mail_lease_check", sql`
    (${t.leaseTokenDigest} is null and ${t.leaseExpiresAt} is null)
    or (${t.leaseTokenDigest} is not null and ${t.leaseTokenDigest} ~ '^[0-9a-f]{64}$'
      and ${t.leaseExpiresAt} is not null and ${t.attempts} > 0 and ${t.leaseExpiresAt} <= ${t.expiresAt})`),
  check("account_mail_payload_bounds", sql`jsonb_typeof(${t.payload}) = 'object'
    and octet_length(${t.payload}::text) between 1 and 2048`),
]);
