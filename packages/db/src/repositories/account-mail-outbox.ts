import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { authChallenges } from "../account-recovery-schema";
import { accountMailOutbox, accountMailQueueGate } from "../account-mail-schema";
import { accountChallengeRepository } from "./account-challenges";
import type { ChallengeIntent } from "./account-challenges";
import { AccountMailCipher } from "./account-mail-crypto";

export class AccountMailQueueFullError extends Error {
  constructor() { super("Account mail queue is full"); this.name = "AccountMailQueueFullError"; }
}

// Queue acceptance is not SMTP acceptance or delivery. This producer is internal
// and returns no token/recipient. All producers must use the same persisted gate.
// No network calls or runtime configuration changes are made by this module.
export class AccountMailOutboxRepository {
  async enqueue(input: ChallengeIntent, cipher: AccountMailCipher): Promise<{
    id: string; challengeId: string; expiresAt: Date;
  }> {
    return accountChallengeRepository.issueForDelivery(input, async (tx, proof) => {
      // issueForDelivery uses READ COMMITTED. The count takes a fresh snapshot
      // after this wait, including the preceding producer's committed insert.
      const [gate] = await tx.select().from(accountMailQueueGate)
        .where(eq(accountMailQueueGate.singleton, true)).for("update");
      if (!gate) throw new Error("Account mail queue is unavailable");
      const [count] = await tx.select({ value: sql<number>`count(*)::integer` }).from(accountMailOutbox);
      if (count.value >= gate.capacity) throw new AccountMailQueueFullError();
      const [live] = await tx.select({ id: authChallenges.id }).from(authChallenges).where(and(
        eq(authChallenges.id, proof.id), isNull(authChallenges.consumedAt),
        isNull(authChallenges.revokedAt), gt(authChallenges.expiresAt, sql`clock_timestamp()`)
      ));
      if (!live) throw new Error("Account confirmation expired before queue acceptance");
      const id = `ame_${randomUUID()}`;
      const payload = cipher.seal({ id, challengeId: proof.id, userId: proof.userId,
        purpose: proof.purpose, expiresAt: proof.expiresAt }, { recipient: proof.email, token: proof.token });
      await tx.insert(accountMailOutbox).values({
        id, challengeId: proof.id, payload, expiresAt: proof.expiresAt, createdAt: sql`clock_timestamp()`,
      });
      return { id, challengeId: proof.id, expiresAt: proof.expiresAt };
    });
  }

  async requiredKeyIds(): Promise<string[]> {
    const rows = await db.execute(sql`
      select distinct
        "payload" ->> 'keyId' as "key_id",
        "payload" ->> 'version' as "version"
      from "account_mail_outbox"
    `);
    const ids = new Set<string>();
    for (const row of rows) {
      const keyId = typeof row.key_id === "string" ? row.key_id : "";
      const version = typeof row.version === "string" ? row.version : "";
      if (version !== "1" || !/^[A-Za-z0-9_-]{1,32}$/.test(keyId)) {
        throw new Error("Account mail queue contains unsupported payload metadata");
      }
      ids.add(keyId);
    }
    return [...ids].sort();
  }

  // Bounded cleanup for the future worker; not scheduled or called by HTTP yet.
  // Only expired pending envelopes are removed, never proof provenance or users.
  async discardExpired(limit = 100): Promise<number> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid account mail cleanup limit");
    return db.transaction(async (tx) => {
      const rows = await tx.select({ id: accountMailOutbox.id }).from(accountMailOutbox)
        .where(lte(accountMailOutbox.expiresAt, sql`clock_timestamp()`))
        .orderBy(accountMailOutbox.expiresAt, accountMailOutbox.id)
        .limit(limit).for("update", { skipLocked: true });
      if (rows.length === 0) return 0;
      const removed = await tx.delete(accountMailOutbox).where(inArray(accountMailOutbox.id, rows.map((r) => r.id)))
        .returning({ id: accountMailOutbox.id });
      return removed.length;
    });
  }
}
export const accountMailOutboxRepository = new AccountMailOutboxRepository();
