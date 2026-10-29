import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { contentRepository, db } from "@nexus/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import {
  discussionNotificationDeliveryRepository as delivery,
  DiscussionNotificationDeliveryRepository,
} from "../packages/db/src/repositories/discussion-notification-delivery";
import {
  auditEvents,
  comments,
  content,
  discussionNotificationDeliveries as jobs,
  follows,
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
    expect(["A publication you follow has a new reply.", "A discussion you participate in has a new reply."]).toContain(
      row.message,
    );
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
  const ids = [ownerId, ...followers].map((recipientId) =>
    noticeId(contentId, comment.id, recipientId),
  );
  const stored = await db
    .select()
    .from(notifications)
    .where(inArray(notifications.id, ids))
    .orderBy(asc(notifications.recipientId));
  expect(stored).toHaveLength(6);
  expect((await source(comment.id)).completedAt).not.toBeNull();
});
