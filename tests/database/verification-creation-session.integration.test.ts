import { randomUUID } from "node:crypto";
import { db, sessionRepository, userRepository, verificationRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  sessions,
  users,
  verificationNotificationDeliveries,
  verificationRequests,
} from "../../site/packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it.each(["revoke", "expire"] as const)(
  "does not create an application when the initiating session is %s-d while waiting",
  async (mode) => {
    const suffix = randomUUID().replaceAll("-", ""),
      actorId = `usr_vcs_${suffix}`,
      sessionId = `ses_vcs_${suffix}`,
      token = `tok_vcs_${suffix}`,
      auditId = `aud_vcs_${suffix}`;
    await userRepository.create({
      id: actorId,
      email: `${actorId}@example.invalid`,
      username: actorId,
      displayName: "Applicant",
    });
    await sessionRepository.create({
      id: sessionId,
      userId: actorId,
      token,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const locked = deferred(),
      release = deferred();
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`verification:user:${actorId}`}))`,
      );
      locked.resolve();
      await release.promise;
      if (mode === "revoke") await tx.delete(sessions).where(eq(sessions.id, sessionId));
      else
        await tx
          .update(sessions)
          .set({ expiresAt: new Date("2000-01-01T00:00:00.000Z") })
          .where(eq(sessions.id, sessionId));
    });
    try {
      await Promise.race([locked.promise, blocker]);
      const pending = verificationRepository
        .createRequest(
          { requesterId: actorId, targetType: "user", targetId: actorId, currentToken: token },
          { id: auditId, actorId, actorType: "user", action: "verification.requested" },
        )
        .then(
          () => null,
          (error: unknown) => error,
        );
      let blocked = false;
      const deadline = Date.now() + 10_000;
      try {
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
      } finally {
        release.resolve();
      }
      await blocker;
      expect(blocked).toBe(true);
      expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
      const requests = await db
        .select()
        .from(verificationRequests)
        .where(eq(verificationRequests.requesterId, actorId));
      expect(requests).toHaveLength(0);
      expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(
        0,
      );
      expect(
        await db
          .select()
          .from(verificationNotificationDeliveries)
          .where(
            sql`${verificationNotificationDeliveries.verificationRequestId} in (select id from ${verificationRequests} where ${verificationRequests.requesterId}=${actorId})`,
          ),
      ).toHaveLength(0);
    } finally {
      release.resolve();
      await blocker.catch(() => {});
      await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
      await db.delete(verificationRequests).where(eq(verificationRequests.requesterId, actorId));
      await db.delete(users).where(eq(users.id, actorId));
    }
  },
  15_000,
);

it("rolls back the application when the session expires during the audit insert", async () => {
  const suffix = randomUUID().replaceAll("-", ""),
    actorId = `usr_vlate_${suffix}`,
    token = `tok_vlate_${suffix}`,
    auditId = `aud_vlate_${suffix}`;
  const expiresAt = new Date(Date.now() + 4_000);
  await userRepository.create({
    id: actorId,
    email: `${actorId}@example.invalid`,
    username: actorId,
    displayName: "Applicant",
  });
  await sessionRepository.create({ id: `ses_vlate_${suffix}`, userId: actorId, token, expiresAt });
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
    const pending = verificationRepository
      .createRequest(
        { requesterId: actorId, targetType: "user", targetId: actorId, currentToken: token },
        { id: auditId, actorId, actorType: "user", action: "verification.requested" },
      )
      .then(
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
    expect(
      await db
        .select()
        .from(verificationRequests)
        .where(eq(verificationRequests.requesterId, actorId)),
    ).toHaveLength(0);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(0);
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(verificationRequests).where(eq(verificationRequests.requesterId, actorId));
    await db.delete(users).where(eq(users.id, actorId));
  }
}, 15_000);
