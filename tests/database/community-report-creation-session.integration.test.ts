import { randomUUID } from "node:crypto";
import { communityReportsRepository, db, sessionRepository, userRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  comments,
  content,
  reportNotificationDeliveries,
  reports,
  sessions,
  users,
} from "../../site/packages/db/src/schema";

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
  throw new Error("Community report transaction did not block");
}

async function fixture(targetType: "content" | "comment", lifetimeMs = 60_000) {
  const key = randomUUID().replaceAll("-", "");
  const actorId = `usr_crs_${key}`;
  const authorId = `usr_cra_${key}`;
  const contentId = `cnt_crs_${key}`;
  const commentId = `cmt_crs_${key}`;
  const sessionId = `ses_crs_${key}`;
  const token = `tok_crs_${key}`;
  const reportId = `rpt_crs_${key}`;
  const auditId = `aud_crs_${key}`;
  const expiresAt = new Date(Date.now() + lifetimeMs);
  for (const id of [actorId, authorId]) {
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: "User",
    });
  }
  await sessionRepository.create({ id: sessionId, userId: actorId, token, expiresAt });
  await db.insert(content).values({
    id: contentId,
    slug: contentId,
    title: "Report target",
    body: "Body",
    authorId,
    status: "published",
    type: "post",
  });
  if (targetType === "comment") {
    await db.insert(comments).values({ id: commentId, contentId, authorId, text: "Comment" });
  }
  const targetId = targetType === "content" ? contentId : commentId;
  const input = {
    actorId,
    currentToken: token,
    id: reportId,
    auditId,
    targetType,
    targetId,
    type: "abuse",
    reason: "Report reason",
    evidenceUrls: [],
  };
  const create = () => communityReportsRepository.submit(input);
  const cleanup = async () => {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(reports).where(eq(reports.id, reportId));
    await db.delete(content).where(eq(content.id, contentId));
    for (const id of [actorId, authorId]) await db.delete(users).where(eq(users.id, id));
  };
  const unchanged = async () => {
    expect(await db.select().from(reports).where(eq(reports.id, reportId))).toHaveLength(0);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(0);
    expect(
      await db
        .select()
        .from(reportNotificationDeliveries)
        .where(eq(reportNotificationDeliveries.reportId, reportId)),
    ).toHaveLength(0);
  };
  return {
    actorId,
    contentId,
    targetType,
    targetId,
    sessionId,
    reportId,
    auditId,
    expiresAt,
    create,
    cleanup,
    unchanged,
  };
}

it.each(["content", "comment"] as const)(
  "creates and deduplicates a report for a valid %s session",
  async (targetType) => {
    const f = await fixture(targetType);
    try {
      expect(await f.create()).toEqual({ id: f.reportId, created: true });
      expect(await f.create()).toEqual({ id: f.reportId, created: false });
      await db.delete(sessions).where(eq(sessions.id, f.sessionId));
      await expect(f.create()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    } finally {
      await f.cleanup();
    }
  },
);

it.each(["content", "comment"] as const)(
  "rejects a revoked session after a %s report advisory lock wait",
  async (targetType) => {
    const f = await fixture(targetType);
    const locked = deferred(),
      release = deferred();
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`report:${f.actorId}:${f.targetType}:${f.targetId}`}))`,
      );
      locked.resolve();
      await release.promise;
      await tx.delete(sessions).where(eq(sessions.id, f.sessionId));
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
      await f.unchanged();
    } finally {
      release.resolve();
      await blocker.catch(() => {});
      await f.cleanup();
    }
  },
  15_000,
);

it("rejects a session expired while waiting for the publication lock", async () => {
  const f = await fixture("comment");
  const locked = deferred(),
    release = deferred();
  let pid = 0;
  const blocker = db.transaction(async (tx) => {
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    pid = Number(row.pid);
    await tx
      .select({ id: content.id })
      .from(content)
      .where(eq(content.id, f.contentId))
      .for("update");
    locked.resolve();
    await release.promise;
    await tx
      .update(sessions)
      .set({ expiresAt: new Date("2000-01-01T00:00:00Z") })
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
    await f.unchanged();
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await f.cleanup();
  }
}, 15_000);

it("rolls back report, audit and delivery if the session expires during a late write wait", async () => {
  const f = await fixture("content", 4_000);
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
    await f.unchanged();
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await f.cleanup();
  }
}, 15_000);
