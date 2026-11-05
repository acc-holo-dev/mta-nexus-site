import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { generateId } from "@nexus/security";
import { eq, inArray, sql } from "drizzle-orm";
import { authService } from "../../apps/web/src/lib/services/auth-service";
import { accountMailOutbox } from "../../packages/db/src/account-mail-schema";
import { accountRecoveryBindings } from "../../packages/db/src/account-recovery-schema";
import { auditEvents, db, users } from "../../packages/db/src/client";
import { accountChallengeRepository as proofs } from "../../packages/db/src/repositories/account-challenges";
import { AccountMailCipher } from "../../packages/db/src/repositories/account-mail-crypto";
import { accountMailOutboxRepository as queue } from "../../packages/db/src/repositories/account-mail-outbox";
import { accountMailWorkerRepository as worker } from "../../packages/db/src/repositories/account-mail-worker";
import { userRepository } from "../../packages/db/src/repositories/users";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const key = randomBytes(32);
export const cipher = new AccountMailCipher("d2b_test", { d2b_test: key });
const password = "Synthetic-D2b-queue-password!";
const owned: string[] = [];

export const auditId = () => generateId("aud");
export { proofs, worker };

export async function account() {
  const username = `d2b_${generateId("usr").slice(-16)}`;
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

export const verification = (a: Account) => ({
  purpose: "email_verify" as const,
  userId: a.userId,
  currentToken: a.currentToken,
  expectedPasswordHash: a.expectedPasswordHash,
  auditId: auditId(),
});

export async function fixture(reset = false) {
  const a = await account();
  if (reset) {
    const proof = await proofs.issue(verification(a));
    await proofs.consume({ ...verification(a), ...proof }, async (tx, p) => {
      await tx.insert(accountRecoveryBindings).values({
        userId: a.userId,
        id: `rcb_${randomUUID()}`,
        verifiedEmail: p.email,
        proofVersion: 1,
        proofChallengeId: p.id,
      });
    });
  }
  const intent = reset
    ? { purpose: "password_reset" as const, userId: a.userId, auditId: auditId() }
    : verification(a);
  return { ...a, intent, job: await queue.enqueue(intent, cipher) };
}

export type Fixture = Awaited<ReturnType<typeof fixture>>;

export async function row(id: string) {
  const [value] = await db.select().from(accountMailOutbox).where(eq(accountMailOutbox.id, id));
  return value;
}

export async function events(id: string) {
  return db.select().from(auditEvents).where(eq(auditEvents.targetId, id));
}

export async function lease(id: string) {
  const value = await worker.claim(id);
  assert.ok(value);
  return value;
}

export async function makeDue(id: string) {
  // Accelerate only our synthetic retry schedule, not the production clock/policy.
  await db
    .update(accountMailOutbox)
    .set({ availableAt: sql`clock_timestamp() - interval '1 second'` })
    .where(eq(accountMailOutbox.id, id));
}

export async function expireLease(id: string) {
  // A controlled clock-state fixture, never a claim of waiting a real minute.
  await db
    .update(accountMailOutbox)
    .set({ leaseExpiresAt: sql`clock_timestamp() - interval '1 millisecond'` })
    .where(eq(accountMailOutbox.id, id));
}

export function postgresCode(error: unknown): string | undefined {
  for (let i = 0; i < 6 && typeof error === "object" && error !== null; i++) {
    if ("code" in error && typeof error.code === "string") return error.code;
    error = "cause" in error ? error.cause : null;
  }
}

export async function settled<T>(p: Promise<T>) {
  try {
    return { ok: true as const, value: await p };
  } catch (error) {
    return { ok: false as const, error };
  }
}

export async function afterWait<T>(
  lock: (tx: Tx) => Promise<unknown>,
  work: () => Promise<T>,
  invalidate: (tx: Tx) => Promise<unknown>,
) {
  let pending: ReturnType<typeof settled<T>> | undefined;
  let completed = false;
  try {
    await db.transaction(async (tx) => {
      await lock(tx);
      const [pidRow] = await tx.execute(sql`select pg_backend_pid() as pid`);
      const pid = Number(pidRow.pid);
      pending = settled(work()).then((value) => {
        completed = true;
        return value;
      });
      const deadline = Date.now() + 3000;
      for (;;) {
        assert.equal(completed, false, "Operation must actually wait for the held database lock");
        const [result] = await db.execute(sql`select exists (
          select 1 from pg_stat_activity where ${pid}::integer = any(pg_blocking_pids(pid))
        ) as waiting`);
        if (result.waiting === true) break;
        if (Date.now() >= deadline) throw new Error("No expected lock wait observed");
        await delay(10);
      }
      await invalidate(tx);
    });
  } finally {
    if (pending) await pending;
  }
  assert.ok(pending);
  const result = await pending;
  assert.equal(result.ok, true, "The queued operation must complete without a database failure");
  return result.ok ? result.value : undefined;
}

/** Delete only synthetic accounts created by this harness, never truncate tables. */
export async function cleanupOwnedAccounts() {
  if (owned.length) await db.delete(users).where(inArray(users.id, owned.splice(0)));
}
