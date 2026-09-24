import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { authChallenges } from "./account-recovery-schema";
import type { SealedMail } from "./repositories/account-mail-crypto";

// Internal, pending mail only. Not exported from the public database barrel.
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
}, (t) => [
  index("account_mail_expiry_idx").on(t.expiresAt),
  check("account_mail_expiry_check", sql`${t.expiresAt} > ${t.createdAt}`),
  check("account_mail_payload_bounds", sql`jsonb_typeof(${t.payload}) = 'object'
    and octet_length(${t.payload}::text) between 1 and 2048`),
]);
