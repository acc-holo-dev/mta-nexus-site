import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { db, auditEvents, sessions, users } from "../client";
import { authRepository } from "./auth";
import { auditRepository } from "./audit";
import { sessionRepository, digestSessionToken } from "./sessions";
import { userRepository } from "./users";
import { ConflictError, UnauthorizedError } from "@nexus/domain";
import { generateId, generateSessionToken, hashPassword } from "@nexus/security";
import { authService } from "../../../../apps/web/src/lib/services/auth-service";

type Mode = "selected" | "others";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const modes: Mode[] = ["selected", "others"];
const password = "Synthetic-revocation-005c-password!";
async function account() {
  const username = `rv_${generateId("usr").slice(-18)}`;
  const input = { username, email: `${username}@example.invalid`, password };
  const first = await authService.register(input);
  const second = await authService.login(input);
  const third = await authService.login(input);
  const current = await sessionRepository.findValidSession(first.token);
  const target = await sessionRepository.findValidSession(second.token);
  const hash = (await userRepository.findByEmail(input.email))?.passwordHash;
  if (!current || !target || !hash) throw new Error("Synthetic account setup failed");
  return { userId: first.user.id, currentToken: first.token, targetToken: second.token,
    thirdToken: third.token, currentId: current.session.id, sessionId: target.session.id,
    expiresAt: current.session.expiresAt, hash, input };
}
type Account = Awaited<ReturnType<typeof account>>;
function revoke(mode: Mode, a: Account, auditId = generateId("aud")): Promise<boolean | number> {
  const data = { userId: a.userId, currentToken: a.currentToken, sessionId: a.sessionId, auditId };
  return mode === "selected" ? authRepository.revokeOwnedSession(data) : authRepository.revokeOtherSessions(data);
}
async function events(userId: string) {
  const rows = await db.select().from(auditEvents).where(eq(auditEvents.actorId, userId));
  return rows.filter((row) => ["user.session_revoked", "user.other_sessions_revoked"].includes(row.action));
}
async function valid(token: string, userId: string) {
  expect((await authService.getSession(token))?.id === userId).toBe(true);
}
async function unchanged(a: Account) {
  await valid(a.currentToken, a.userId);
  await valid(a.targetToken, a.userId);
  await valid(a.thirdToken, a.userId);
  expect((await userRepository.findByEmail(a.input.email))?.passwordHash === a.hash).toBe(true);
}
async function settled<T>(promise: Promise<T>) {
  try { return { ok: true as const, value: await promise }; }
  catch (error) { return { ok: false as const, error }; }
}
function postgresCode(error: unknown): string | undefined {
  for (let i = 0; i < 6 && typeof error === "object" && error !== null; i++) {
    if ("code" in error && typeof error.code === "string") return error.code;
    error = "cause" in error ? error.cause : null;
  }
}

// Hold a real row lock, observe the operation waiting in PostgreSQL, invalidate
// only our synthetic initiator, then release it. No sleeps to guess lock order,
// production test hooks, fake session responses or pre-existing account writes.
async function afterLockWait(a: Account, mode: Mode, invalidate: (tx: Tx) => Promise<unknown>) {
  const state: { pending?: ReturnType<typeof settled<boolean | number>> } = {};
  let completed = false;
  try {
    await db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, a.userId)).for("update");
      const pids = await tx.execute(sql`select pg_backend_pid() as pid`);
      const pid = Number(pids[0].pid);
      state.pending = settled(revoke(mode, a)).then((result) => { completed = true; return result; });
      const deadline = Date.now() + 3_000;
      while (true) {
        expect(completed, "Revocation must wait for the common user lock").toBe(false);
        const rows = await db.execute(sql`select exists (
          select 1 from pg_stat_activity where ${pid}::integer = any(pg_blocking_pids(pid))
        ) as waiting`);
        if (rows[0].waiting === true) break;
        if (Date.now() >= deadline) throw new Error("Did not observe the expected database lock wait");
        await delay(10);
      }
      await invalidate(tx);
    });
  } finally {
    // Drain the operation even if the barrier assertion fails. The transaction
    // above releases its lock first, so failures cannot strand a queued request.
    if (state.pending) await state.pending;
  }
  if (!state.pending) throw new Error("The queued operation was not started");
  const result = await state.pending;
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBeInstanceOf(UnauthorizedError);
}

describe("session listing behavior", () => {
  it("returns active metadata only and never exposes session tokens", async () => {
    const a = await account();
    const third = await sessionRepository.findValidSession(a.thirdToken);
    if (!third) throw new Error("Third synthetic session is unavailable");

    const expiredId = generateId("ses");
    await sessionRepository.create({
      id: expiredId,
      userId: a.userId,
      token: generateSessionToken(),
      expiresAt: new Date(Date.now() - 60_000),
      ipAddress: "203.0.113.50",
      userAgent: "expired-session-fixture",
    });

    const listed = await sessionRepository.listByUser(a.userId);
    expect(listed.map((session) => session.id).sort()).toEqual(
      [a.currentId, a.sessionId, third.session.id].sort(),
    );
    expect(listed.some((session) => session.id === expiredId)).toBe(false);

    for (const session of listed) {
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect("token" in session).toBe(false);
      expect("userId" in session).toBe(false);
      expect(Object.keys(session).sort()).toEqual([
        "createdAt",
        "expiresAt",
        "id",
        "ipAddress",
        "userAgent",
      ]);
    }
  });
});

describe("manual session revocation transaction", () => {
  it("ends only the selected session, records one safe audit, and does not audit a replay", async () => {
    const a = await account();
    expect(await authService.revokeSession(a.userId, a.sessionId, a.currentToken)).toBe(true);
    expect(await authService.getSession(a.targetToken)).toBeNull();
    await valid(a.currentToken, a.userId);
    await valid(a.thirdToken, a.userId);
    const rows = await events(a.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("user.session_revoked");
    expect(rows[0].details).toEqual({ sessionId: a.sessionId });
    expect(await authService.revokeSession(a.userId, a.sessionId, a.currentToken)).toBe(false);
    expect(await events(a.userId)).toHaveLength(1);
  });

  it("ends others atomically, counts active sessions only and preserves this browser and another account", async () => {
    const a = await account();
    const b = await account();
    await sessionRepository.create({ id: generateId("ses"), userId: a.userId,
      token: generateSessionToken(), expiresAt: new Date(Date.now() - 60_000) });
    expect(await authService.revokeOtherSessions(a.userId, a.currentToken)).toBe(2);
    expect(await authService.getSession(a.targetToken)).toBeNull();
    expect(await authService.getSession(a.thirdToken)).toBeNull();
    const current = await sessionRepository.findValidSession(a.currentToken);
    expect(current?.session.id).toBe(a.currentId);
    expect(current?.session.expiresAt.getTime()).toBe(a.expiresAt.getTime());
    expect((await userRepository.findByEmail(a.input.email))?.passwordHash === a.hash).toBe(true);
    await unchanged(b);
    expect(await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, a.userId))).toHaveLength(1);
    const rows = await events(a.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].details).toEqual({ revokedCount: 2, removedSessionCount: 3 });
    expect(await authService.revokeOtherSessions(a.userId, a.currentToken)).toBe(0);
    expect(await events(a.userId)).toHaveLength(1);
  });

  it.each(modes)("%s: audit insertion conflict rolls back every deletion", async (mode) => {
    const a = await account();
    const auditId = generateId("aud");
    await auditRepository.record({ id: auditId, actorId: a.userId, actorType: "user",
      action: "test.audit_collision", targetId: a.userId, targetType: "user" });
    const result = await settled(revoke(mode, a, auditId));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(postgresCode(result.error)).toBe("23505");
    await unchanged(a);
    expect(await events(a.userId)).toHaveLength(0);
  });

  it.each(modes)("%s: rejects missing, foreign, expired and revoked initiators before deleting", async (mode) => {
    const a = await account();
    const b = await account();
    const expired = generateSessionToken();
    await sessionRepository.create({ id: generateId("ses"), userId: a.userId,
      token: expired, expiresAt: new Date(Date.now() - 60_000) });
    const revoked = await authService.login(a.input);
    await authService.logout(revoked.token);
    for (const token of ["", generateSessionToken(), b.currentToken, expired, revoked.token]) {
      await expect(revoke(mode, { ...a, currentToken: token })).rejects.toBeInstanceOf(UnauthorizedError);
    }
    await expect(revoke(mode, { ...a, userId: generateId("usr") })).rejects.toBeInstanceOf(UnauthorizedError);
    await unchanged(a);
    await unchanged(b);
    expect(await events(a.userId)).toHaveLength(0);
  });

  it("protects current and foreign sessions inside the repository, not just the route", async () => {
    const a = await account();
    const b = await account();
    await expect(revoke("selected", { ...a, sessionId: a.currentId })).rejects.toBeInstanceOf(ConflictError);
    expect(await revoke("selected", { ...a, sessionId: b.currentId })).toBe(false);
    expect(await revoke("selected", { ...a, sessionId: generateId("ses") })).toBe(false);
    await unchanged(a);
    await unchanged(b);
    expect(await events(a.userId)).toHaveLength(0);
  });

  it("concurrent revocations of the same target commit only one deletion and audit", async () => {
    const a = await account();
    const results = await Promise.all([revoke("selected", a), revoke("selected", a)]);
    expect(results.filter((result) => result === true)).toHaveLength(1);
    expect(results.filter((result) => result === false)).toHaveLength(1);
    expect(await authService.getSession(a.targetToken)).toBeNull();
    await valid(a.currentToken, a.userId);
    expect(await events(a.userId)).toHaveLength(1);
  });

  it("two competing end-others requests cannot both use a now-revoked initiator", async () => {
    const a = await account();
    const results = await Promise.all([
      settled(revoke("others", a)),
      settled(revoke("others", { ...a, currentToken: a.targetToken })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const winner = results[0].ok ? 0 : 1;
    const loser = results[1 - winner];
    if (loser.ok) throw new Error("Both conflicting revocations succeeded");
    expect(loser.error).toBeInstanceOf(UnauthorizedError);
    await valid(winner === 0 ? a.currentToken : a.targetToken, a.userId);
    expect(await authService.getSession(winner === 0 ? a.targetToken : a.currentToken)).toBeNull();
    expect(await authService.getSession(a.thirdToken)).toBeNull();
    expect(await events(a.userId)).toHaveLength(1);
  });

  it("manual revocation and a password change from the target session have one valid winner", async () => {
    const a = await account();
    const nextToken = generateSessionToken();
    const nextHash = await hashPassword("Synthetic-revocation-next-password!");
    const [manual, passwordChange] = await Promise.all([
      settled(revoke("selected", a)),
      settled(authRepository.changePassword({ userId: a.userId, expectedPasswordHash: a.hash,
        passwordHash: nextHash, currentToken: a.targetToken, nextToken,
        audit: { id: generateId("aud"), actorId: a.userId, actorType: "user",
          action: "user.password_changed", targetId: a.userId, targetType: "user" } })),
    ]);
    expect(Number(manual.ok) + Number(passwordChange.ok)).toBe(1);
    const currentHash = (await userRepository.findByEmail(a.input.email))?.passwordHash;
    if (manual.ok) {
      expect(manual.value).toBe(true);
      expect(currentHash === a.hash).toBe(true);
      await valid(a.currentToken, a.userId);
      await valid(a.thirdToken, a.userId);
      expect(await authService.getSession(nextToken)).toBeNull();
      expect(await events(a.userId)).toHaveLength(1);
    } else {
      expect(manual.error).toBeInstanceOf(UnauthorizedError);
      expect(currentHash === nextHash).toBe(true);
      await valid(nextToken, a.userId);
      expect(await authService.getSession(a.currentToken)).toBeNull();
      expect(await authService.getSession(a.thirdToken)).toBeNull();
      expect(await events(a.userId)).toHaveLength(0);
    }
    if (!passwordChange.ok) expect(passwordChange.error).toBeInstanceOf(UnauthorizedError);
    expect(await authService.getSession(a.targetToken)).toBeNull();
  });

  it("a concurrent login is either included in the revocation or is a later valid login", async () => {
    const a = await account();
    const token = generateSessionToken();
    const [count] = await Promise.all([
      authService.revokeOtherSessions(a.userId, a.currentToken),
      authRepository.createLoginSession({ id: generateId("ses"), userId: a.userId,
        token, expiresAt: new Date(Date.now() + 60_000) },
        { id: generateId("aud"), actorId: a.userId, actorType: "user",
          action: "user.logged_in", targetId: a.userId, targetType: "user" }, a.hash),
    ]);
    const laterLogin = await authService.getSession(token);
    expect(count).toBe(laterLogin ? 2 : 3);
    if (laterLogin) expect(laterLogin.id).toBe(a.userId);
    await valid(a.currentToken, a.userId);
    expect(await authService.getSession(a.targetToken)).toBeNull();
    expect(await authService.getSession(a.thirdToken)).toBeNull();
    expect(await events(a.userId)).toHaveLength(1);
    // Ending sessions is not a password change or a ban on future sign-ins.
    expect((await authService.login(a.input)).user.id).toBe(a.userId);
  });

  for (const mode of modes) {
    it(`${mode}: rechecks an initiator revoked while waiting for the user lock`, async () => {
      const a = await account();
      await afterLockWait(a, mode, (tx) => tx.delete(sessions).where(eq(sessions.id, a.currentId)));
      expect(await authService.getSession(a.currentToken)).toBeNull();
      await valid(a.targetToken, a.userId);
      await valid(a.thirdToken, a.userId);
      expect(await events(a.userId)).toHaveLength(0);
    }, 10_000);

    it(`${mode}: rechecks expiry after the real lock wait`, async () => {
      const a = await account();
      await afterLockWait(a, mode, (tx) => tx.update(sessions)
        .set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(sessions.id, a.currentId)));
      expect(await authService.getSession(a.currentToken)).toBeNull();
      await valid(a.targetToken, a.userId);
      await valid(a.thirdToken, a.userId);
      expect(await events(a.userId)).toHaveLength(0);
    }, 10_000);

    it(`${mode}: rejects a token rotated while waiting instead of trusting the prior route check`, async () => {
      const a = await account();
      const nextToken = generateSessionToken();
      await afterLockWait(a, mode, (tx) => tx.update(sessions)
        .set({ token: digestSessionToken(nextToken) }).where(eq(sessions.id, a.currentId)));
      expect(await authService.getSession(a.currentToken)).toBeNull();
      await valid(nextToken, a.userId);
      await valid(a.targetToken, a.userId);
      await valid(a.thirdToken, a.userId);
      expect(await events(a.userId)).toHaveLength(0);
    }, 10_000);
  }
});
