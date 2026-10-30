import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { contentRepository, db } from "@nexus/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import {
  DiscussionNotificationDeliveryRepository,
  discussionNotificationDeliveryRepository as delivery,
} from "../packages/db/src/repositories/discussion-notification-delivery";
import {
  auditEvents,
  comments,
  content,
  follows,
  discussionNotificationDeliveries as jobs,
  notifications,
  users,
} from "../packages/db/src/schema";

const actors: string[] = [];
const publications: string[] = [];
const triggers: { table: string; name: string }[] = [];
const id = (prefix: string) => `${prefix}_disc_delivery_${randomUUID().replaceAll("-", "")}`;
const noticeId = (contentId: string, commentId: string, recipientId: string) =>
  `ntf_reply_${createHash("sha256")
    .update(JSON.stringify([1, contentId, commentId, recipientId]))
    .digest("hex")}`;

afterEach(async () => {
  vi.restoreAllMocks();
  for (const { table, name } of triggers.splice(0)) {
    await db.execute(sql.raw(`drop trigger if exists ${name} on ${table}`));
    await db.execute(sql.raw(`drop function if exists ${name}()`));
  }
  if (publications.length) {
    await db.delete(content).where(inArray(content.id, publications));
  }
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  publications.length = 0;
});

async function actor(prefix = "usr") {
  const userId = id(prefix);
  await db.insert(users).values({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "PRIVATE_DISPLAY",
    role: "user",
    createdAt: new Date("2000-01-01T00:00:00Z"),
  });
  actors.push(userId);
  return userId;
}

async function publication(authorId: string) {
  const contentId = id("cnt");
  publications.push(contentId);
  await db.insert(content).values({
    id: contentId,
    slug: contentId,
    authorId,
    type: "post",
    status: "published",
    title: "PRIVATE_TITLE",
    body: "PRIVATE_BODY",
  });
  return contentId;
}

async function follow(followerId: string, contentId: string) {
  await db.insert(follows).values({
    id: id("fol"),
    followerId,
    targetType: "content",
    targetId: contentId,
    createdAt: new Date("2000-06-01T00:00:00Z"),
  });
}

async function reply(authorId: string, contentId: string, parentId?: string) {
  return contentRepository.addComment(
    {
      id: id("cmt"),
      contentId,
      authorId,
      parentId,
      text: "PRIVATE_COMMENT_TEXT",
      isVerifiedPurchase: false,
    },
    {
      id: id("aud"),
      actorId: authorId,
      actorType: "user",
      action: "content.comment_added",
      targetId: contentId,
      targetType: "content",
    },
  );
}

async function source(commentId: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.commentId, commentId));
  if (!row) throw Error("Missing delivery source");
  return row;
}

async function ready(commentId: string) {
  await db
    .update(jobs)
    .set({ availableAt: new Date(0) })
    .where(eq(jobs.commentId, commentId));
}

async function drain(commentId: string, limit = 20) {
  for (let page = 0; page < 40; page++) {
    if ((await source(commentId)).completedAt) return;
    await ready(commentId);
    expect(["progress", "completed"]).toContain((await delivery.processNext(limit)).state);
  }
  throw Error("Discussion delivery did not complete");
}

async function failInsert(table: "notifications", value: string) {
  const name = `discussion_delivery_failure_${randomUUID().replaceAll("-", "")}`;
  if (!/^[A-Za-z0-9_]+$/u.test(value)) throw Error("Unsafe fixture ID");
  await db.execute(
    sql.raw(
      `create function ${name}() returns trigger language plpgsql as $$ begin raise exception 'PRIVATE_INSERT_FAILURE'; end $$`,
    ),
  );
  triggers.push({ table, name });
  await db.execute(
    sql.raw(
      `create trigger ${name} before insert on ${table} for each row when (new.recipient_id = '${value}') execute function ${name}()`,
    ),
  );
  return async () => {
    await db.execute(sql.raw(`drop trigger ${name} on ${table}`));
    await db.execute(sql.raw(`drop function ${name}()`));
    triggers.splice(
      triggers.findIndex((entry) => entry.name === name),
      1,
    );
  };
}

async function noticesFor(contentId: string, commentId: string, recipientIds: string[]) {
  return db
    .select()
    .from(notifications)
    .where(
      inArray(
        notifications.id,
        recipientIds.map((recipientId) => noticeId(contentId, commentId, recipientId)),
      ),
    )
    .orderBy(asc(notifications.recipientId));
}

it("atomically creates the comment with its delivery source", async () => {
  const authorId = await actor();
  const contentId = await publication(authorId);
  const name = `discussion_delivery_block_${randomUUID().replaceAll("-", "")}`;
  await db.execute(
    sql.raw(
      `create function ${name}() returns trigger language plpgsql as $$ begin raise exception 'PRIVATE_INSERT_FAILURE'; end $$`,
    ),
  );
  triggers.push({ table: "discussion_notification_deliveries", name });
  await db.execute(
    sql.raw(
      `create trigger ${name} before insert on discussion_notification_deliveries for each row execute function ${name}()`,
    ),
  );
  await expect(reply(authorId, contentId)).rejects.toThrow();
  expect(await db.select().from(comments).where(eq(comments.contentId, contentId))).toEqual([]);
  expect(await db.select().from(jobs)).toEqual([]);
  expect(await db.select().from(auditEvents).where(eq(auditEvents.actorId, authorId))).toEqual([]);
  await db.execute(sql.raw(`drop trigger ${name} on discussion_notification_deliveries`));
  await db.execute(sql.raw(`drop function ${name}()`));
  triggers.splice(
    triggers.findIndex((entry) => entry.name === name),
    1,
  );
  const comment = await reply(authorId, contentId);
  expect(await source(comment.id)).toMatchObject({
    contentId,
    directCompleted: false,
    completedAt: null,
  });
});

it("delivers direct and follower notices with generic copy and current eligibility", async () => {
  const ownerId = await actor("own");
  const followerId = await actor("fol");
  const lateFollowerId = await actor("late");
  const commenterId = await actor("cmt");
  const contentId = await publication(ownerId);
  await follow(followerId, contentId);
  await follow(lateFollowerId, contentId);
  await db
    .update(follows)
    .set({ createdAt: new Date("2099-01-01T00:00:00Z") })
    .where(eq(follows.followerId, lateFollowerId));
  const comment = await reply(commenterId, contentId);
  await ready(comment.id);
  expect(await delivery.processNext()).toMatchObject({ state: "progress" });
  expect(await source(comment.id)).toMatchObject({ directCompleted: true });
  await drain(comment.id);
  const stored = await db
    .select()
    .from(notifications)
    .where(
      inArray(notifications.id, [
        noticeId(contentId, comment.id, ownerId),
        noticeId(contentId, comment.id, followerId),
        noticeId(contentId, comment.id, lateFollowerId),
        noticeId(contentId, comment.id, commenterId),
      ]),
    )
    .orderBy(asc(notifications.recipientId));
  expect(stored.map((row) => row.recipientId).sort()).toEqual([followerId, ownerId].sort());
  for (const row of stored) {
    expect(row.title).toBe("New discussion reply");
    expect([
      "A publication you follow has a new reply.",
      "A discussion you participate in has a new reply.",
    ]).toContain(row.message);
    expect(JSON.stringify(row)).not.toContain("PRIVATE_");
    expect(JSON.stringify(row)).not.toContain(commenterId);
  }
  const dispatcher = await readFile(
    path.resolve(import.meta.dirname, "../packages/db/scripts/run-web-push-dispatcher.ts"),
    "utf8",
  );
  expect(dispatcher).toContain("discussionNotificationDeliveryRepository");
  expect(dispatcher).toContain("discussion-delivery");
});

it("pages followers with stable cursors across concurrent workers", async () => {
  const ownerId = await actor("own");
  const commenterId = await actor("cmt");
  const contentId = await publication(ownerId);
  const followers = await Promise.all(Array.from({ length: 5 }, () => actor("fol")));
  for (const followerId of followers) await follow(followerId, contentId);
  const comment = await reply(commenterId, contentId);
  await ready(comment.id);
  expect(await delivery.processNext(20)).toMatchObject({ state: "progress", recipients: 1 });
  await Promise.all([
    delivery.processNext(2),
    new DiscussionNotificationDeliveryRepository().processNext(2),
  ]);
  await drain(comment.id, 2);
  const stored = await noticesFor(contentId, comment.id, [ownerId, ...followers]);
  expect(stored).toHaveLength(6);
  expect((await source(comment.id)).completedAt).not.toBeNull();
});

it("rolls back a failed follower page, bounds retries and resumes after an operator reset", async () => {
  const ownerId = await actor("own");
  const firstFollower = await actor("fol");
  const secondFollower = await actor("fol");
  const commenterId = await actor("cmt");
  const contentId = await publication(ownerId);
  await follow(firstFollower, contentId);
  await follow(secondFollower, contentId);
  const comment = await reply(commenterId, contentId);
  await ready(comment.id);
  expect(await delivery.processNext(20)).toMatchObject({ state: "progress" });
  expect(await source(comment.id)).toMatchObject({ directCompleted: true });
  // Owner was delivered in the direct phase; keep that durable page.
  expect(await noticesFor(contentId, comment.id, [ownerId])).toHaveLength(1);
  const removeFailure = await failInsert("notifications", secondFollower);
  for (let attempt = 1; attempt <= 5; attempt++) {
    await ready(comment.id);
    expect(await delivery.processNext(2)).toEqual({
      state: attempt === 5 ? "failed" : "retry",
      recipients: 0,
      stored: 0,
      pushDeferred: 0,
    });
    expect(await source(comment.id)).toMatchObject({
      attempts: attempt,
      directCompleted: true,
      completedAt: null,
      lastFollowerId: null,
    });
    expect((await source(comment.id)).availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(await noticesFor(contentId, comment.id, [firstFollower, secondFollower])).toEqual([]);
  }
  expect((await delivery.stats()).failed).toBeGreaterThanOrEqual(1);
  expect(await delivery.processNext(2)).toEqual({
    state: "idle",
    recipients: 0,
    stored: 0,
    pushDeferred: 0,
  });
  await removeFailure();
  await ready(comment.id);
  await delivery.processNext(2);
  expect(await noticesFor(contentId, comment.id, [firstFollower, secondFollower])).toEqual([]);
  await db.update(jobs).set({ attempts: 0 }).where(eq(jobs.commentId, comment.id));
  await drain(comment.id, 2);
  expect(
    (await noticesFor(contentId, comment.id, [ownerId, firstFollower, secondFollower])).map(
      (row) => row.recipientId,
    ),
  ).toEqual([firstFollower, secondFollower, ownerId].sort());
});

it("recovers a lost process before commit with no partial follower page", async () => {
  const ownerId = await actor("own");
  const followerId = await actor("fol");
  const commenterId = await actor("cmt");
  const contentId = await publication(ownerId);
  await follow(followerId, contentId);
  const comment = await reply(commenterId, contentId);
  await ready(comment.id);
  expect(await delivery.processNext()).toMatchObject({ state: "progress" });
  expect(await noticesFor(contentId, comment.id, [ownerId])).toHaveLength(1);
  const original = db.transaction.bind(db);
  vi.spyOn(db, "transaction").mockImplementationOnce((run) =>
    original(async (tx) => {
      await run(tx);
      throw Error("SIMULATED_PROCESS_EXIT");
    }),
  );
  await expect(delivery.processNext()).rejects.toThrow("SIMULATED_PROCESS_EXIT");
  vi.restoreAllMocks();
  expect(await source(comment.id)).toMatchObject({
    attempts: 0,
    directCompleted: true,
    lastFollowerId: null,
    completedAt: null,
  });
  expect(await noticesFor(contentId, comment.id, [followerId])).toEqual([]);
  await drain(comment.id);
  expect(
    (await noticesFor(contentId, comment.id, [ownerId, followerId])).map((row) => row.recipientId),
  ).toEqual([followerId, ownerId].sort());
});

it("does not duplicate notices or clear read state after completed delivery", async () => {
  const ownerId = await actor("own");
  const commenterId = await actor("cmt");
  const contentId = await publication(ownerId);
  const comment = await reply(commenterId, contentId);
  await drain(comment.id);
  const notice = noticeId(contentId, comment.id, ownerId);
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, notice));
  expect(await delivery.processNext()).toEqual({
    state: "idle",
    recipients: 0,
    stored: 0,
    pushDeferred: 0,
  });
  expect(await noticesFor(contentId, comment.id, [ownerId])).toEqual([
    expect.objectContaining({ id: notice, isRead: true }),
  ]);
});
