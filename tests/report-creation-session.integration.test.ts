import { randomUUID } from "node:crypto";
import { db, reportRepository, sessionRepository, userRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  reportNotificationDeliveries,
  reports,
  sessions,
  users,
} from "../packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitBlocked(pid: number) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const [row] = await db.execute<{ blocked: boolean }>(
      sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid))) as blocked`,
    );
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Report transaction did not block");
}
async function fixture(lifetimeMs = 60_000) {
  const key = randomUUID().replaceAll("-", ""),
    actorId = `usr_rps_${key}`,
    targetId = `usr_rpt_${key}`,
    sessionId = `ses_rps_${key}`,
    token = `tok_rps_${key}`,
    reportId = `rpt_rps_${key}`,
    auditId = `aud_rps_${key}`,
    expiresAt = new Date(Date.now() + lifetimeMs);
  for (const id of [actorId, targetId])
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: "User",
    });
  await sessionRepository.create({ id: sessionId, userId: actorId, token, expiresAt });
  const data = {
    id: reportId,
    reporterId: actorId,
    targetType: "user" as const,
    targetId,
    type: "abuse" as const,
    reason: "Report reason",
    evidenceUrls: [],
    status: "open" as const,
  };
  const audit = {
    id: auditId,
    actorId,
    actorType: "user" as const,
    action: "report.created",
    targetType: "report",
    targetId: reportId,
  };
  const create = () => reportRepository.createWithAudit(data, audit, token);
  const cleanup = async () => {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(reports).where(eq(reports.id, reportId));
    for (const id of [actorId, targetId]) await db.delete(users).where(eq(users.id, id));
  };
  return { actorId, targetId, sessionId, reportId, auditId, expiresAt, create, cleanup };
}
it.each(["revoke", "expire"] as const)(
  "rejects report creation if the session is %s-d during the advisory lock wait",
  async (mode) => {
    const f = await fixture();
    const locked = deferred(),
      release = deferred();
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`report:${f.actorId}:user:${f.targetId}`}))`,
      );
      locked.resolve();
      await release.promise;
      if (mode === "revoke") await tx.delete(sessions).where(eq(sessions.id, f.sessionId));
      else
        await tx
          .update(sessions)
          .set({ expiresAt: new Date("2000-01-01T00:00:00.000Z") })
          .where(eq(sessions.id, f.sessionId));
    });
    try {
      await Promise.race([locked.promise, blocker]);
      const pending = f.create().then(
        () => null,
        (error: unknown) => error,
      );
      try {
        await waitBlocked(pid);
      } finally {
        release.resolve();
      }
      await blocker;
      expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
      expect(await db.select().from(reports).where(eq(reports.id, f.reportId))).toHaveLength(0);
      expect(await db.select().from(auditEvents).where(eq(auditEvents.id, f.auditId))).toHaveLength(
        0,
      );
      expect(
        await db
          .select()
          .from(reportNotificationDeliveries)
          .where(eq(reportNotificationDeliveries.reportId, f.reportId)),
      ).toHaveLength(0);
    } finally {
      release.resolve();
      await blocker.catch(() => {});
      await f.cleanup();
    }
  },
  15_000,
);

it("does not return an existing report to a revoked initiating session", async () => {
  const f = await fixture();
  try {
    expect((await f.create()).created).toBe(true);
    await db.delete(sessions).where(eq(sessions.id, f.sessionId));
    await expect(f.create()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  } finally {
    await f.cleanup();
  }
});

it("rolls back report and notification if the session expires while the audit insert waits", async () => {
  const f = await fixture(4_000);
  const locked = deferred(),
    release = deferred();
  let pid = 0;
  const blocker = db.transaction(async (tx) => {
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    pid = Number(row.pid);
    await tx.insert(auditEvents).values({
      id: f.auditId,
      actorId: f.actorId,
      actorType: "user",
      action: "fixture",
      targetId: f.reportId,
      targetType: "report",
    });
    locked.resolve();
    await release.promise;
    throw new Error("rollback fixture");
  });
  try {
    await Promise.race([locked.promise, blocker]);
    const pending = f.create().then(
      () => null,
      (error: unknown) => error,
    );
    await waitBlocked(pid);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, f.expiresAt.getTime() - Date.now() + 150)),
    );
    release.resolve();
    await blocker.catch(() => {});
    expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
    expect(await db.select().from(reports).where(eq(reports.id, f.reportId))).toHaveLength(0);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, f.auditId))).toHaveLength(
      0,
    );
    expect(
      await db
        .select()
        .from(reportNotificationDeliveries)
        .where(eq(reportNotificationDeliveries.reportId, f.reportId)),
    ).toHaveLength(0);
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await f.cleanup();
  }
}, 15_000);
