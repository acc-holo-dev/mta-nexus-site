import { randomUUID } from "node:crypto";
import { db, sessionRepository, userRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  commentIdFromIntentKey,
  contentCommentsRepository,
} from "../packages/db/src/repositories/content-comments";
import {
  auditEvents,
  comments,
  content,
  discussionNotificationDeliveries,
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
  throw new Error("Comment transaction did not block");
}
async function fixture(lifetimeMs = 60_000) {
  const key = randomUUID().replaceAll("-", "");
  const actorId = `usr_ac_${key}`,
    contentId = `cnt_ac_${key}`,
    sessionId = `ses_ac_${key}`,
    token = `tok_ac_${key}`,
    auditId = `aud_ac_${key}`;
  const intentKey = randomUUID(),
    commentId = commentIdFromIntentKey(intentKey);
  const expiresAt = new Date(Date.now() + lifetimeMs);
  await userRepository.create({
    id: actorId,
    email: `${actorId}@example.invalid`,
    username: actorId,
    displayName: "Commenter",
  });
  await sessionRepository.create({ id: sessionId, userId: actorId, token, expiresAt });
  await db.insert(content).values({
    id: contentId,
    slug: `article-${key}`,
    authorId: actorId,
    type: "post",
    status: "published",
    title: "Article",
    body: "Article body",
  });
  const create = () =>
    contentCommentsRepository.addArticleComment({
      intentKey,
      contentId,
      authorId: actorId,
      currentToken: token,
      text: "A useful comment",
      audit: {
        id: auditId,
        actorId,
        actorType: "user",
        action: "content.comment_added",
        targetType: "content",
        targetId: contentId,
      },
    });
  const cleanup = async () => {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(content).where(eq(content.id, contentId));
    await db.delete(users).where(eq(users.id, actorId));
  };
  return { actorId, contentId, sessionId, auditId, commentId, expiresAt, create, cleanup };
}
async function expectNoComment(f: Awaited<ReturnType<typeof fixture>>) {
  expect(await db.select().from(comments).where(eq(comments.id, f.commentId))).toHaveLength(0);
  expect(
    await db
      .select()
      .from(discussionNotificationDeliveries)
      .where(eq(discussionNotificationDeliveries.commentId, f.commentId)),
  ).toHaveLength(0);
  expect(await db.select().from(auditEvents).where(eq(auditEvents.id, f.auditId))).toHaveLength(0);
  const [article] = await db
    .select({ commentCount: content.commentCount })
    .from(content)
    .where(eq(content.id, f.contentId));
  expect(article.commentCount).toBe(0);
}
it("rejects creation after session revocation during the article lock wait", async () => {
  const f = await fixture(),
    ready = deferred(),
    release = deferred();
  let pid = 0;
  const blocker = db.transaction(async (tx) => {
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    pid = Number(row.pid);
    await tx.select().from(content).where(eq(content.id, f.contentId)).for("update");
    ready.resolve();
    await release.promise;
    await tx.delete(sessions).where(eq(sessions.id, f.sessionId));
  });
  try {
    await Promise.race([ready.promise, blocker]);
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
    await expectNoComment(f);
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await f.cleanup();
  }
}, 15_000);
it("rejects replay after revocation without returning a previously created comment", async () => {
  const f = await fixture();
  try {
    expect(await f.create()).toMatchObject({ kind: "created" });
    expect(await f.create()).toMatchObject({ kind: "replayed" });
    await db.delete(sessions).where(eq(sessions.id, f.sessionId));
    await expect(f.create()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await db.select().from(comments).where(eq(comments.id, f.commentId))).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
it("rolls back comment, counter, delivery and audit if session expires while audit waits", async () => {
  const f = await fixture(5_000),
    ready = deferred(),
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
      targetType: "content",
      targetId: f.contentId,
    });
    ready.resolve();
    await release.promise;
    throw new Error("rollback fixture");
  });
  try {
    await Promise.race([ready.promise, blocker]);
    const pending = f.create().then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await waitBlocked(pid);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, f.expiresAt.getTime() - Date.now() + 150)),
      );
    } finally {
      release.resolve();
    }
    await blocker.catch(() => {});
    expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
    await expectNoComment(f);
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await f.cleanup();
  }
}, 15_000);
