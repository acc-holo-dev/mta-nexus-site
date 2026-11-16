import { createHash, randomUUID } from "node:crypto";
import { authRepository, db, sessionRepository, userRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { auditEvents, organizations, sessions, users } from "../../packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

it.each(["password", "context", "revoke-one", "revoke-others"] as const)(
  "rolls back %s if the initiating session expires while audit insertion waits",
  async (action) => {
    const key = randomUUID().replaceAll("-", ""),
      actorId = `usr_authlate_${key}`,
      token = `tok_authlate_${key}`,
      nextToken = `tok_authnext_${key}`,
      sessionId = `ses_authlate_${key}`,
      otherId = `ses_authother_${key}`,
      auditId = `aud_authlate_${key}`,
      organizationId = `org_authlate_${key}`,
      expiresAt = new Date(Date.now() + 4_000);
    await userRepository.create({
      id: actorId,
      email: `${actorId}@example.invalid`,
      username: actorId,
      displayName: "User",
      passwordHash: "old-hash",
    });
    await sessionRepository.create({ id: sessionId, userId: actorId, token, expiresAt });
    await sessionRepository.create({
      id: otherId,
      userId: actorId,
      token: `tok_other_${key}`,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    await db
      .insert(organizations)
      .values({ id: organizationId, ownerId: actorId, name: "Org", slug: organizationId });
    const locked = deferred(),
      release = deferred();
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx.insert(auditEvents).values({
        id: auditId,
        actorId,
        actorType: "user",
        action: "fixture",
        targetId: actorId,
        targetType: "user",
      });
      locked.resolve();
      await release.promise;
      throw new Error("rollback fixture");
    });
    try {
      await Promise.race([locked.promise, blocker]);
      const audit = {
        id: auditId,
        actorId,
        actorType: "user" as const,
        action: "user.password_changed",
        targetId: actorId,
        targetType: "user",
      };
      const actionPromise =
        action === "password"
          ? authRepository.changePassword({
              userId: actorId,
              expectedPasswordHash: "old-hash",
              passwordHash: "new-hash",
              currentToken: token,
              nextToken,
              audit,
            })
          : action === "context"
            ? authRepository.switchContext({
                userId: actorId,
                contextId: organizationId,
                currentToken: token,
                auditId,
              })
            : action === "revoke-one"
              ? authRepository.revokeOwnedSession({
                  userId: actorId,
                  sessionId: otherId,
                  currentToken: token,
                  auditId,
                })
              : authRepository.revokeOtherSessions({
                  userId: actorId,
                  currentToken: token,
                  auditId,
                });
      const pending = actionPromise.then(
        () => null,
        (error: unknown) => error,
      );
      let blocked = false;
      const deadline = Date.now() + 3_000;
      while (Date.now() < deadline) {
        const [row] = await db.execute<{ blocked: boolean }>(
          sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid))) as blocked`,
        );
        if (row?.blocked) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now() + 150)),
      );
      release.resolve();
      await blocker.catch(() => {});
      expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
      const [storedUser] = await db
        .select({ passwordHash: users.passwordHash, activeContextId: users.activeContextId })
        .from(users)
        .where(eq(users.id, actorId));
      expect(storedUser).toEqual({ passwordHash: "old-hash", activeContextId: "personal" });
      const storedSessions = await db
        .select({ id: sessions.id, token: sessions.token })
        .from(sessions)
        .where(eq(sessions.userId, actorId));
      expect(storedSessions).toEqual(
        expect.arrayContaining([
          { id: sessionId, token: digest(token) },
          { id: otherId, token: digest(`tok_other_${key}`) },
        ]),
      );
      expect(storedSessions).toHaveLength(2);
      expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(
        0,
      );
    } finally {
      release.resolve();
      await blocker.catch(() => {});
      await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
      await db.delete(organizations).where(eq(organizations.id, organizationId));
      await db.delete(users).where(eq(users.id, actorId));
    }
  },
  15_000,
);
