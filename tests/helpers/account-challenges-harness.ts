import { expect } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { UnauthorizedError } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { db, auditEvents } from "../../packages/db/src/client";
import {
  accountAuthState,
  accountRecoveryBindings,
  authChallenges,
} from "../../packages/db/src/account-recovery-schema";
import {
  accountChallengeRepository as repo,
  type ConsumedProof,
} from "../../packages/db/src/repositories/account-challenges";
import { userRepository } from "../../packages/db/src/repositories/users";
import { authService } from "../../apps/web/src/lib/services/auth-service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const password = "Synthetic-D1-known-password!";
export const auditId = () => generateId("aud");
export { repo };

export async function account() {
  const username = `d1_${generateId("usr").slice(-18)}`;
  const input = { username, email: `${username}@example.invalid`, password };
  const first = await authService.register(input);
  const second = await authService.login(input);
  const stored = await userRepository.findByEmail(input.email);
  if (!stored?.passwordHash) throw new Error("Synthetic fixture missing password hash");
  return {
    userId: first.user.id,
    currentToken: first.token,
    otherToken: second.token,
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

export const reset = (a: Account, id = auditId()) => ({
  purpose: "password_reset" as const,
  userId: a.userId,
  auditId: id,
});

export const noMutation = async () => true;

export async function bind(tx: Tx, proof: ConsumedProof) {
  // A synthetic DB action, not an implemented email/HTTP flow. No passwords,
  // sessions, email flags or privileges are changed by this fixture callback.
  if (proof.purpose !== "email_verify") throw new Error("Wrong fixture purpose");
  await tx.insert(accountRecoveryBindings).values({
    userId: proof.userId,
    id: `rcb_${randomUUID()}`,
    verifiedEmail: proof.email,
    proofVersion: 1,
    proofChallengeId: proof.id,
  });
  return true;
}

export async function enrolled(a: Account) {
  const c = await repo.issue(verification(a));
  await repo.consume({ ...verification(a), ...c }, bind);
  return c;
}

export async function challenge(id: string) {
  const [row] = await db.select().from(authChallenges).where(eq(authChallenges.id, id));
  return row;
}

export async function version(a: Account) {
  const [row] = await db
    .select()
    .from(accountAuthState)
    .where(eq(accountAuthState.userId, a.userId));
  return row?.credentialVersion ?? 0;
}

export async function events(a: Account, action = "auth.challenge_consumed") {
  return db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.actorId, a.userId), eq(auditEvents.action, action)));
}

export async function unchanged(a: Account) {
  expect(
    (await userRepository.findByEmail(a.input.email))?.passwordHash === a.expectedPasswordHash,
  ).toBe(true);
  expect((await authService.getSession(a.currentToken))?.id === a.userId).toBe(true);
  expect((await authService.getSession(a.otherToken))?.id === a.userId).toBe(true);
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

export async function afterWait(
  lock: (tx: Tx) => Promise<unknown>,
  operation: () => Promise<unknown>,
  invalidate: (tx: Tx) => Promise<unknown>,
) {
  let pending: ReturnType<typeof settled<unknown>> | undefined;
  let completed = false;
  try {
    await db.transaction(async (tx) => {
      await lock(tx);
      const rows = await tx.execute(sql`select pg_backend_pid() as pid`);
      const pid = Number(rows[0].pid);
      pending = settled(operation()).then((r) => {
        completed = true;
        return r;
      });
      const deadline = Date.now() + 3000;
      for (;;) {
        expect(completed, "The proof operation must really wait for the held lock").toBe(false);
        const waiting = await db.execute(sql`select exists (
          select 1 from pg_stat_activity where ${pid}::integer = any(pg_blocking_pids(pid))
        ) as waiting`);
        if (waiting[0].waiting === true) break;
        if (Date.now() >= deadline) throw new Error("No database lock wait observed");
        await delay(10);
      }
      await invalidate(tx);
    });
  } finally {
    if (pending) await pending;
  }
  if (!pending) throw new Error("Queued operation was not started");
  const result = await pending;
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBeInstanceOf(UnauthorizedError);
}
