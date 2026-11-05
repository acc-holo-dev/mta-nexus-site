import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { generateId } from "@nexus/security";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterEach } from "vitest";
import { authService } from "../../apps/web/src/lib/services/auth-service";
import { accountMailOutbox, accountMailQueueGate } from "../../packages/db/src/account-mail-schema";
import { authChallenges } from "../../packages/db/src/account-recovery-schema";
import { auditEvents, db, users } from "../../packages/db/src/client";
import {
  digestAccountChallenge,
  accountChallengeRepository as proofs,
} from "../../packages/db/src/repositories/account-challenges";
import type { MailContext } from "../../packages/db/src/repositories/account-mail-crypto";
import { AccountMailCipher } from "../../packages/db/src/repositories/account-mail-crypto";
import {
  AccountMailQueueFullError,
  accountMailOutboxRepository as queue,
} from "../../packages/db/src/repositories/account-mail-outbox";
import { userRepository } from "../../packages/db/src/repositories/users";

export const key = randomBytes(32);
export const cipher = new AccountMailCipher("d2_test", { d2_test: key });
export const password = "Synthetic-D2-queue-password!";
export const auditId = () => generateId("aud");
export { AccountMailQueueFullError, digestAccountChallenge, proofs, queue };

let owned: string[] = [];
let restoreCapacity: number | undefined;

export async function account() {
  const username = `d2_${generateId("usr").slice(-18)}`;
  const input = { username, email: `${username}@example.invalid`, password };
  const first = await authService.register(input);
  owned.push(first.user.id);
  const stored = await userRepository.findByEmail(input.email);
  assert.ok(stored?.passwordHash);
  return {
    userId: first.user.id,
    currentToken: first.token,
    expectedPasswordHash: stored.passwordHash,
    input,
  };
}

type Account = Awaited<ReturnType<typeof account>>;

export const verification = (a: Account, id = auditId()) => ({
  purpose: "email_verify" as const,
  userId: a.userId,
  currentToken: a.currentToken,
  expectedPasswordHash: a.expectedPasswordHash,
  auditId: id,
});

export async function pending(a: Account) {
  return db
    .select()
    .from(authChallenges)
    .where(
      and(
        eq(authChallenges.userId, a.userId),
        isNull(authChallenges.consumedAt),
        isNull(authChallenges.revokedAt),
      ),
    );
}

export async function mail(id: string) {
  const [row] = await db
    .select({ mail: accountMailOutbox, proof: authChallenges })
    .from(accountMailOutbox)
    .innerJoin(authChallenges, eq(accountMailOutbox.challengeId, authChallenges.id))
    .where(eq(accountMailOutbox.id, id));
  assert.ok(row, "Expected synthetic queued mail");
  const context: MailContext = {
    id: row.mail.id,
    challengeId: row.proof.id,
    userId: row.proof.userId,
    purpose: row.proof.purpose,
    expiresAt: row.mail.expiresAt,
  };
  return { ...row, context, decoded: cipher.open(context, row.mail.payload) };
}

export async function exists(id: string) {
  return (
    (
      await db
        .select({ id: accountMailOutbox.id })
        .from(accountMailOutbox)
        .where(eq(accountMailOutbox.id, id))
    ).length === 1
  );
}

export async function issued(a: Account) {
  return db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.actorId, a.userId), eq(auditEvents.action, "auth.challenge_issued")));
}

export async function capacity(value: number) {
  const [gate] = await db.select().from(accountMailQueueGate);
  assert.ok(gate);
  restoreCapacity ??= gate.capacity;
  await db
    .update(accountMailQueueGate)
    .set({ capacity: value })
    .where(eq(accountMailQueueGate.singleton, true));
}

export async function settled<T>(promise: Promise<T>) {
  try {
    return { ok: true as const, value: await promise };
  } catch (error) {
    return { ok: false as const, error };
  }
}

export function postgresCode(error: unknown): string | undefined {
  for (let i = 0; i < 6 && typeof error === "object" && error !== null; i++) {
    if ("code" in error && typeof error.code === "string") return error.code;
    error = "cause" in error ? error.cause : null;
  }
}

export async function clearDisposableOutbox() {
  // Capacity arithmetic is global: the queue gate is a singleton row. Other
  // suites that share the disposable database may leave envelopes behind, so
  // the capacity tests start from a provably empty queue instead of assuming
  // file execution order.
  await db.delete(accountMailOutbox);
}

afterEach(async () => {
  // Only accounts created by this file; never truncate shared tables.
  try {
    if (owned.length) await db.delete(users).where(inArray(users.id, owned));
  } finally {
    owned = [];
    if (restoreCapacity !== undefined) {
      await db
        .update(accountMailQueueGate)
        .set({ capacity: restoreCapacity })
        .where(eq(accountMailQueueGate.singleton, true));
      restoreCapacity = undefined;
    }
  }
});
