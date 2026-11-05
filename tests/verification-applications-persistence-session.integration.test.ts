import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  amend,
  auditEvents,
  db,
  deferred,
  digestSessionToken,
  eq,
  repo,
  request,
  sessions,
  sql,
  user,
  users,
  verificationRequests,
  waitBlocked,
} from "./helpers/verification-applications-persistence-harness";

describe("verification applications persistence: session rechecks during lock waits", () => {
  it("rejects amendment after session revocation while waiting on the application", async () => {
    const actorId = await user(),
      application = await request(actorId),
      previous = await repo.application(actorId, application.id);
    const ready = deferred(),
      release = deferred();
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx
        .select({ id: verificationRequests.id })
        .from(verificationRequests)
        .where(eq(verificationRequests.id, application.id))
        .for("update");
      ready.resolve();
      await release.promise;
      await tx.delete(sessions).where(eq(sessions.token, digestSessionToken(`tok_${actorId}`)));
    });
    try {
      await Promise.race([ready.promise, blocker]);
      const pending = amend(actorId, application.id, previous.revision).then(
        () => null,
        (error: unknown) => error,
      );
      await waitBlocked(pid);
      release.resolve();
      await blocker;
      expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
      const [stored] = await db
        .select()
        .from(verificationRequests)
        .where(eq(verificationRequests.id, application.id));
      expect(stored.proofUrl).toBe("https://example.test/old");
      expect(
        (
          await db.select().from(auditEvents).where(eq(auditEvents.targetId, application.id))
        ).filter((a) => a.action === "verification.application_updated"),
      ).toHaveLength(0);
    } finally {
      release.resolve();
      await blocker.catch(() => {});
      await db.delete(verificationRequests).where(eq(verificationRequests.id, application.id));
      await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
      await db.delete(users).where(eq(users.id, actorId));
    }
  }, 15000);

  it("rolls back amendment if the initiating session expires during an audit wait", async () => {
    const actorId = await user(),
      application = await request(actorId),
      previous = await repo.application(actorId, application.id),
      auditId = `aud_wait_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 4000);
    await db
      .update(sessions)
      .set({ expiresAt })
      .where(eq(sessions.token, digestSessionToken(`tok_${actorId}`)));
    const ready = deferred(),
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
        targetType: "verification",
        targetId: application.id,
      });
      ready.resolve();
      await release.promise;
      throw new Error("rollback fixture");
    });
    try {
      await Promise.race([ready.promise, blocker]);
      const pending = amend(actorId, application.id, previous.revision, auditId).then(
        () => null,
        (error: unknown) => error,
      );
      await waitBlocked(pid);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now() + 150)),
      );
      release.resolve();
      await blocker.catch(() => {});
      expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
      const [stored] = await db
        .select()
        .from(verificationRequests)
        .where(eq(verificationRequests.id, application.id));
      expect(stored.proofUrl).toBe("https://example.test/old");
      expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(
        0,
      );
    } finally {
      release.resolve();
      await blocker.catch(() => {});
      await db.delete(verificationRequests).where(eq(verificationRequests.id, application.id));
      await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
      await db.delete(users).where(eq(users.id, actorId));
    }
  }, 15000);
});
