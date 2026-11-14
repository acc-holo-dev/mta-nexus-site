import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { db, sessions } from "../client";
import { lockInitiatingSession } from "./initiating-session";
import { authService } from "../../../../src/lib/services/auth-service";
import { sessionRepository } from "./sessions";
import { UnauthorizedError } from "@nexus/domain";
import { generateId, generateSessionToken } from "@nexus/security";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const password = "Initiating-barrier-005c-password!";

async function account() {
  const username = `ibi_${generateId("usr").slice(-16)}`;
  const input = { username, email: `${username}@example.invalid`, password };
  const first = await authService.register(input);
  const second = await authService.login(input);
  const current = await sessionRepository.findValidSession(first.token);
  const other = await sessionRepository.findValidSession(second.token);
  if (!current || !other) throw new Error("Synthetic account setup failed");
  return {
    userId: first.user.id,
    currentToken: first.token,
    targetToken: second.token,
    sessionId: current.session.id,
    otherSessionId: other.session.id,
    input,
  };
}
type Account = Awaited<ReturnType<typeof account>>;

// Controlled barrier for F08. lockInitiatingSession takes `FOR UPDATE` on the
// initiating session row, so the holder must lock that same session row for the
// queued call to genuinely wait. Once the holder invalidates (expires/removes)
// the row and commits, the queued grant must fail as Unauthorized.
async function afterSessionBarrierWait(a: Account, invalidate: (tx: Tx) => Promise<unknown>) {
  const state: { pending?: ReturnType<typeof settled<void>> } = {};
  let completed = false;
  try {
    await db.transaction(async (tx) => {
      const holderPid = Number((await tx.execute(sql`select pg_backend_pid() as pid`))[0].pid);
      await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.id, a.sessionId))
        .for("update");
      // The write path must contend on a fresh connection: wrap the queued
      // lockInitiatingSession in its own top-level transaction so it genuinely
      // waits on the session row locked by this holder.
      state.pending = Promise.resolve(
        db.transaction((tx2) => lockInitiatingSession(tx2, a.userId, a.currentToken)),
      ).then(
        (value) => {
          completed = true;
          return { ok: true as const, value };
        },
        (error) => ({ ok: false as const, error }),
      );
      const deadline = Date.now() + 3_000;
      while (true) {
        expect(completed, "Barrier wait must observe a real row-lock wait").toBe(false);
        // Any backend blocked by the holder (the queued lockInitiatingSession)
        // means we have observed the real PostgreSQL wait on the session row.
        const rows = await db.execute(sql`select exists (
          select 1 from pg_stat_activity
          where ${holderPid}::integer = any(pg_blocking_pids(pid))
        ) as waiting`);
        if (rows[0].waiting === true) break;
        if (Date.now() >= deadline)
          throw new Error("Did not observe the expected database lock wait");
        await delay(10);
      }
      await invalidate(tx);
    });
  } finally {
    if (state.pending) await state.pending;
  }
  if (!state.pending) throw new Error("The queued lockInitiatingSession was not started");
  const result = await state.pending;
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBeInstanceOf(UnauthorizedError);
}

function settled<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );
}

describe("initiating-session lock barrier (controlled)", () => {
  it("grants when the initiating session is live and owned", async () => {
    const a = await account();
    await db.transaction(async (tx) => {
      await lockInitiatingSession(tx, a.userId, a.currentToken);
    });
    expect(await sessionRepository.findValidSession(a.currentToken)).not.toBeNull();
  });

  it("waits on the held session lock, then fails with Unauthorized once the initiator is expired", async () => {
    const a = await account();
    await afterSessionBarrierWait(a, async (tx) => {
      await tx
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(sessions.id, a.sessionId));
    });
    // F08: once the barrier lifts, the queued write path did not grant, and the
    // initiator is no longer valid, so no new build/receipt can start.
    expect(await sessionRepository.findValidSession(a.currentToken)).toBeNull();
  });

  it("waits on the held session lock, then fails with Unauthorized once the initiator is removed", async () => {
    const a = await account();
    await afterSessionBarrierWait(a, async (tx) => {
      await tx.delete(sessions).where(eq(sessions.id, a.sessionId));
    });
    expect(await sessionRepository.findValidSession(a.currentToken)).toBeNull();
  });

  it("rejects missing, expired, foreign and empty initiators without a grant", async () => {
    const a = await account();
    const b = await account();
    const expired = generateSessionToken();
    await sessionRepository.create({
      id: generateId("ses"),
      userId: a.userId,
      token: expired,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const revoked = await authService.login(a.input);
    await authService.logout(revoked.token);
    for (const token of ["", generateSessionToken(), expired, b.currentToken, revoked.token]) {
      await expect(
        db.transaction((tx) => lockInitiatingSession(tx, a.userId, token)),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    }
    await expect(
      db.transaction((tx) => lockInitiatingSession(tx, generateId("usr"), a.currentToken)),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    // The untouched initiators were never revoked.
    expect(await sessionRepository.findValidSession(a.currentToken)).not.toBeNull();
    expect(await sessionRepository.findValidSession(b.currentToken)).not.toBeNull();
  });
});
