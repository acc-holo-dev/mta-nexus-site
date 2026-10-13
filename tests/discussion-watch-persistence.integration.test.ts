import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  auditEvents,
  comments,
  content,
  db,
  follows,
  followWorkspaceRepository as followsRepository,
  notificationRepository,
  notifications,
  sessionRepository,
  userRepository,
  users,
  webPushOutbox,
  webPushSubscriptionRepository,
  webPushSubscriptions,
} from "@nexus/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import {
  previewDiscussionReplay,
  readDiscussionReplayPage,
  resolveDiscussionReplayDatabaseIdentity,
} from "../apps/web/scripts/discussion-replay-database";
import { withDiscussionReplayCheckpoint } from "../apps/web/scripts/discussion-replay-storage";
import { notifyDiscussionReplies } from "../apps/web/src/lib/services/discussion-follow-notification-service";
import { replayDiscussionNotifications } from "../apps/web/src/lib/services/discussion-notification-replay";
import { discussionPushReceipt } from "../packages/db/src/repositories/discussion-push-receipt";

const actors: string[] = [];
afterEach(async () => {
  if (actors.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    await db.delete(content).where(inArray(content.authorId, actors));
    await db.delete(users).where(inArray(users.id, actors));
  }
  actors.length = 0;
});
async function actor() {
  const key = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_watch_${key}`,
    username: `watch_${key}`,
    email: `${key}@nexus.test`,
    displayName: "Participant",
    role: "user",
  });
  actors.push(user.id);
  return user;
}
async function publication(authorId: string) {
  const [row] = await db
    .insert(content)
    .values({
      id: `cnt_${randomUUID()}`,
      slug: `watch-${randomUUID()}`,
      authorId,
      type: "post",
      status: "published",
      title: "Publication secret marker",
      body: "Body secret marker",
    })
    .returning();
  return row;
}
async function reply(contentId: string, authorId: string, parentId?: string) {
  const [row] = await db
    .insert(comments)
    .values({
      id: `cmt_${randomUUID()}`,
      contentId,
      authorId,
      parentId,
      text: "Comment secret marker",
      createdAt: sql`clock_timestamp()`,
    })
    .returning();
  await db
    .update(content)
    .set({ commentCount: sql`${content.commentCount}+1` })
    .where(eq(content.id, contentId));
  return row;
}
const subscribe = (actorId: string, contentId: string) =>
  followsRepository.setFollowing(actorId, "content", contentId, true, `fol_${randomUUID()}`);
const deliver = (recipientId: string, contentId: string, commentId: string) =>
  notificationRepository.createDiscussionReplyWithPush({ recipientId, contentId, commentId });
it("previews inclusive microsecond boundaries with bounded tied rows and no inbox/push writes", async () => {
  const owner = await actor(),
    reader = await actor(),
    item = await publication(owner.id);
  await subscribe(reader.id, item.id);
  const first = await reply(item.id, owner.id),
    second = await reply(item.id, owner.id),
    outside = await reply(item.id, owner.id);
  const [clock] = await db.execute(sql`select
    to_char((clock_timestamp() - interval '1 hour') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as boundary,
    to_char((clock_timestamp() + interval '1 day') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as future`);
  const boundary = clock.boundary as string,
    future = clock.future as string;
  await db
    .update(comments)
    .set({ createdAt: sql`${boundary}::timestamptz` })
    .where(inArray(comments.id, [first.id, second.id]));
  await db
    .update(comments)
    .set({ createdAt: sql`${boundary}::timestamptz + interval '1 microsecond'` })
    .where(eq(comments.id, outside.id));
  const expected = [first.id, second.id].sort();
  const page = await readDiscussionReplayPage(boundary, boundary, null);
  expect(page.map((row) => row.id)).toEqual(expected);
  expect(
    (
      await readDiscussionReplayPage(boundary, boundary, { createdAt: boundary, id: expected[0] })
    ).map((row) => row.id),
  ).toEqual([expected[1]]);
  expect(
    await previewDiscussionReplay({ from: boundary, until: boundary, limit: 1, repairPush: true }),
  ).toMatchObject({
    dryRun: true,
    deliveryPolicy: "inbox-and-pending-push",
    matchingComments: 1,
    hasMore: true,
    checkpoint: "ignored",
  });
  const complete = await previewDiscussionReplay({
    from: boundary,
    until: boundary,
    limit: 2,
    repairPush: false,
  });
  expect(complete).toMatchObject({ matchingComments: 2, hasMore: false });
  expect(JSON.stringify(complete)).not.toMatch(/secret marker|usr_|cnt_|cmt_|postgres/);
  await expect(
    previewDiscussionReplay({ from: boundary, until: future, limit: 2, repairPush: false }),
  ).rejects.toThrow("database time");
  expect(
    await db
      .select()
      .from(notifications)
      .where(inArray(notifications.recipientId, [owner.id, reader.id])),
  ).toHaveLength(0);
  expect(
    await db
      .select({ id: webPushOutbox.id })
      .from(webPushOutbox)
      .innerJoin(notifications, eq(notifications.id, webPushOutbox.notificationId))
      .where(inArray(notifications.recipientId, [owner.id, reader.id])),
  ).toHaveLength(0);
});
it("persists idempotent own subscriptions, exposes latest public replies, masks archived metadata and removes its private key", async () => {
  const owner = await actor(),
    reader = await actor(),
    other = await actor(),
    item = await publication(owner.id);
  const confirmations = await Promise.all(
    Array.from({ length: 5 }, () => subscribe(reader.id, item.id)),
  );
  expect(confirmations.filter((row) => row.created)).toHaveLength(1);
  const comment = await reply(item.id, owner.id);
  expect((await followsRepository.page(reader.id, { type: "content" })).items[0]).toMatchObject({
    title: item.title,
    discussion: { replyCount: 1, latestId: comment.id },
  });
  expect((await followsRepository.page(other.id, { type: "content" })).items).toHaveLength(0);
  await db.update(content).set({ status: "archived" }).where(eq(content.id, item.id));
  expect((await followsRepository.page(reader.id, { type: "content" })).items[0]).toMatchObject({
    title: null,
    handle: null,
    description: null,
    image: null,
    discussion: null,
  });
  expect(
    (await followsRepository.page(reader.id, { type: "content", query: "secret marker" })).items,
  ).toHaveLength(0);
  await expect(subscribe(other.id, item.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await followsRepository.setFollowing(reader.id, "content", item.id, false, "unused");
  expect((await followsRepository.page(reader.id, { type: "content" })).items).toHaveLength(0);
});
it("excludes subscriptions created after an event including a removed and newly subscribed identity", async () => {
  const owner = await actor(),
    early = await actor(),
    late = await actor(),
    item = await publication(owner.id);
  await subscribe(early.id, item.id);
  const event = await reply(item.id, owner.id),
    audience = await followsRepository.discussionAudience(item.id, event.id);
  if (!audience) throw Error("Public reply audience was not available");
  await subscribe(late.id, item.id);
  expect(
    (
      await followsRepository.discussionFollowers(item.id, audience.createdAt, [owner.id])
    ).items.map((row) => row.recipientId),
  ).toEqual([early.id]);
  expect((await deliver(late.id, item.id, event.id)).state).toBe("skipped");
  await followsRepository.setFollowing(early.id, "content", item.id, false, "unused");
  await subscribe(early.id, item.id);
  expect((await deliver(early.id, item.id, event.id)).state).toBe("skipped");
});
it("notifies each current direct participant and subscriber once while omitting the writer", async () => {
  const owner = await actor(),
    parentAuthor = await actor(),
    reader = await actor(),
    writer = await actor(),
    item = await publication(owner.id);
  await Promise.all([
    subscribe(owner.id, item.id),
    subscribe(parentAuthor.id, item.id),
    subscribe(reader.id, item.id),
    subscribe(writer.id, item.id),
  ]);
  const parent = await reply(item.id, parentAuthor.id),
    event = await reply(item.id, writer.id, parent.id);
  const result = await notifyDiscussionReplies(item.id, event.id);
  expect(result).toMatchObject({ attempted: 3, stored: 3, failed: 0 });
  const rows = await db
    .select()
    .from(notifications)
    .where(inArray(notifications.recipientId, [owner.id, parentAuthor.id, reader.id, writer.id]));
  expect(rows).toHaveLength(3);
  expect(new Set(rows.map((row) => row.recipientId))).toEqual(
    new Set([owner.id, parentAuthor.id, reader.id]),
  );
  expect(
    rows.every(
      (row) => row.link === `/articles/${item.slug}?comment=${event.id}#comment-${event.id}`,
    ),
  ).toBe(true);
  expect(JSON.stringify(rows)).not.toContain("secret marker");
});
it("applies independent follow/content preferences and retains current direct participation after unsubscribe", async () => {
  const owner = await actor(),
    reader = await actor(),
    writer = await actor(),
    item = await publication(owner.id);
  await Promise.all([subscribe(owner.id, item.id), subscribe(reader.id, item.id)]);
  await notificationRepository.updatePreferences(owner.id, {
    followsEnabled: false,
    contentEnabled: true,
  });
  await notificationRepository.updatePreferences(reader.id, {
    followsEnabled: false,
    contentEnabled: true,
  });
  const event = await reply(item.id, writer.id);
  expect((await deliver(owner.id, item.id, event.id)).state).toBe("stored");
  expect((await deliver(reader.id, item.id, event.id)).state).toBe("suppressed");
  const [notice] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, owner.id));
  expect(notice.category).toBe("content");
  await followsRepository.setFollowing(owner.id, "content", item.id, false, "unused");
  const second = await reply(item.id, writer.id);
  expect((await deliver(owner.id, item.id, second.id)).state).toBe("stored");
  await notificationRepository.updatePreferences(owner.id, { contentEnabled: false });
  const third = await reply(item.id, writer.id);
  expect((await deliver(owner.id, item.id, third.id)).state).toBe("suppressed");
});
it("safely replays one notification without reverting its read state or duplicating pushes", async () => {
  const owner = await actor(),
    reader = await actor(),
    item = await publication(owner.id);
  await subscribe(reader.id, item.id);
  const event = await reply(item.id, owner.id);
  const first = await deliver(reader.id, item.id, event.id);
  expect(first).toMatchObject({ state: "stored", pushJobs: 0 });
  const [notice] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, reader.id));
  await notificationRepository.markAsRead(notice.id, reader.id);
  expect(await deliver(reader.id, item.id, event.id)).toMatchObject({
    state: "duplicate",
    pushJobs: 0,
  });
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, reader.id)),
  ).toMatchObject([{ id: notice.id, isRead: true }]);
  await db.delete(comments).where(eq(comments.id, event.id));
  expect((await deliver(reader.id, item.id, event.id)).state).toBe("skipped");
});
it("serializes delivery behind an unsubscribe and a publication archive without a stale notice", async () => {
  const owner = await actor(),
    reader = await actor(),
    item = await publication(owner.id);
  await subscribe(reader.id, item.id);
  const event = await reply(item.id, owner.id);
  let unlock!: () => void, locked!: () => void;
  const barrier = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const release = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const mutation = db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([reader.id, "content", item.id])},0))`,
    );
    await tx
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, reader.id),
          eq(follows.targetType, "content"),
          eq(follows.targetId, item.id),
        ),
      );
    locked();
    await release;
  });
  await barrier;
  const notification = deliver(reader.id, item.id, event.id);
  unlock();
  await mutation;
  expect((await notification).state).toBe("skipped");
  await subscribe(reader.id, item.id);
  const second = await reply(item.id, owner.id);
  let releaseArchive!: () => void, archiveLocked!: () => void;
  const archiveBarrier = new Promise<void>((resolve) => {
    archiveLocked = resolve;
  });
  const archiveRelease = new Promise<void>((resolve) => {
    releaseArchive = resolve;
  });
  const archive = db.transaction(async (tx) => {
    await tx.update(content).set({ status: "archived" }).where(eq(content.id, item.id));
    archiveLocked();
    await archiveRelease;
  });
  await archiveBarrier;
  const hidden = deliver(reader.id, item.id, second.id);
  releaseArchive();
  await archive;
  expect((await hidden).state).toBe("skipped");
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, reader.id)),
  ).toHaveLength(0);
});

it("resumes bound replay after checkpoint failure without duplicate inbox rows or lost read state", async () => {
  const owner = await actor(),
    reader = await actor(),
    writer = await actor();
  const item = await publication(owner.id);
  await subscribe(reader.id, item.id);
  const event = await reply(item.id, writer.id);
  const audience = await followsRepository.discussionAudience(item.id, event.id);
  if (!audience) throw Error("Missing audience");
  const identity = await resolveDiscussionReplayDatabaseIdentity();
  const time = audience.createdAt;
  const directory = await mkdtemp(join(tmpdir(), "nexus-replay-db-"));
  const path = join(directory, "checkpoint.json");
  const row = { id: event.id, contentId: item.id, createdAt: time };
  const page = async (cursor: { id: string } | null) => (cursor ? [] : [row]);
  const deliver = (contentId: string, commentId: string) =>
    notifyDiscussionReplies(contentId, commentId, { maxFollowerPages: 1 });
  try {
    await expect(
      withDiscussionReplayCheckpoint(path, time, time, { identity }, async ({ initial, save }) => {
        await save(initial);
        await replayDiscussionNotifications(
          initial,
          {
            page,
            deliver,
            save: async () => {
              throw Error("Checkpoint write interrupted");
            },
          },
          10,
        );
      }),
    ).rejects.toThrow("Checkpoint write interrupted");
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({
      version: 2,
      databaseIdentity: identity,
      checkpoint: { cursor: null, completed: false },
    });
    const notices = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.recipientId, [owner.id, reader.id, writer.id]));
    expect(notices).toHaveLength(2);
    await notificationRepository.markAsRead(notices[0].id, notices[0].recipientId);
    await withDiscussionReplayCheckpoint(
      path,
      time,
      time,
      { identity },
      async ({ initial, save }) => {
        const result = await replayDiscussionNotifications(initial, { page, deliver, save }, 10);
        expect(result).toMatchObject({
          processed: 1,
          blocked: false,
          checkpoint: { completed: true },
          metrics: { attempted: 2, duplicate: 2, stored: 0, failed: 0 },
        });
      },
    );
    const after = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.recipientId, [owner.id, reader.id, writer.id]));
    expect(after).toHaveLength(2);
    expect(after.find((notice) => notice.id === notices[0].id)?.isRead).toBe(true);
    await expect(
      withDiscussionReplayCheckpoint(
        path,
        time,
        time,
        { identity: "0".repeat(64), adoptLegacy: true },
        async () => {
          throw Error("Should not deliver");
        },
      ),
    ).rejects.toThrow("another database");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rolls optional jobs back with their failed receipt, then repairs once without adding late devices or renewing TTL", async () => {
  const owner = await actor(),
    reader = await actor(),
    item = await publication(owner.id);
  await subscribe(reader.id, item.id);
  const token = randomUUID().replaceAll("-", "");
  const sessionId = `ses_repair_${token}`,
    earlyId = `wps_early_${token}`,
    lateId = `wps_late_${token}`;
  await sessionRepository.create({
    id: sessionId,
    userId: reader.id,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  const addDevice = (id: string) =>
    webPushSubscriptionRepository.upsert({
      id,
      userId: reader.id,
      sessionId,
      endpoint: `https://push.example.invalid/${id}`,
      p256dh: "a".repeat(87),
      auth: "b".repeat(22),
      expirationAt: null,
    });
  await addDevice(earlyId);
  await db
    .update(webPushSubscriptions)
    .set({ createdAt: sql`clock_timestamp() - interval '1 minute'` })
    .where(eq(webPushSubscriptions.id, earlyId));
  const event = await reply(item.id, owner.id);
  const functionName = `repair_proof_${token}`,
    triggerName = `repair_proof_trigger_${token}`;
  if (!/^[A-Za-z0-9_]+$/.test(reader.id)) throw Error("Unsafe fixture identifier");
  try {
    await db.execute(
      sql.raw(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.recipient_id = '${reader.id}' AND NEW.data->'discussionPush'->>'state' = 'queued' THEN
        RAISE EXCEPTION 'fixture proof failure'; END IF; RETURN NEW; END $$`),
    );
    await db.execute(
      sql.raw(
        `CREATE TRIGGER ${triggerName} BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      ),
    );
    const first = await notificationRepository.createDiscussionReplyWithPush({
      recipientId: reader.id,
      contentId: item.id,
      commentId: event.id,
    });
    expect(first).toMatchObject({ state: "stored", pushJobs: 0, pushQueueState: "error" });
    const [notice] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, reader.id));
    expect(discussionPushReceipt(notice.data)).toBe("pending");
    expect(
      await db.select().from(webPushOutbox).where(eq(webPushOutbox.notificationId, notice.id)),
    ).toHaveLength(0);
    await db.execute(sql.raw(`DROP TRIGGER ${triggerName} ON notifications`));
    await db.execute(sql.raw(`DROP FUNCTION ${functionName}()`));
    await addDevice(lateId);
    await db
      .update(webPushSubscriptions)
      .set({ createdAt: sql`${notice.createdAt}::timestamptz + interval '1 second'` })
      .where(eq(webPushSubscriptions.id, lateId));
    await notificationRepository.updatePreferences(reader.id, { followsEnabled: false });
    expect(
      (
        await notificationRepository.createDiscussionReplyWithPush({
          recipientId: reader.id,
          contentId: item.id,
          commentId: event.id,
          repairPush: true,
        })
      ).state,
    ).toBe("suppressed");
    await notificationRepository.updatePreferences(reader.id, { followsEnabled: true });
    const recovered = await Promise.all(
      Array.from({ length: 4 }, () =>
        notificationRepository.createDiscussionReplyWithPush({
          recipientId: reader.id,
          contentId: item.id,
          commentId: event.id,
          repairPush: true,
        }),
      ),
    );
    expect(recovered.reduce((sum, value) => sum + value.pushJobs, 0)).toBe(1);
    expect(recovered.every((value) => value.state === "duplicate")).toBe(true);
    const jobs = await db
      .select()
      .from(webPushOutbox)
      .where(eq(webPushOutbox.notificationId, notice.id));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].subscriptionId).toBe(earlyId);
    const [deadline] = await db.execute(
      sql`select o.expires_at = n.created_at + interval '24 hours' as exact from web_push_outbox o inner join notifications n on n.id = o.notification_id where n.id = ${notice.id}`,
    );
    expect(deadline.exact).toBe(true);
    await db.delete(webPushOutbox).where(eq(webPushOutbox.notificationId, notice.id));
    expect(
      (
        await notificationRepository.createDiscussionReplyWithPush({
          recipientId: reader.id,
          contentId: item.id,
          commentId: event.id,
          repairPush: true,
        })
      ).pushJobs,
    ).toBe(0);
    const [settled] = await db.select().from(notifications).where(eq(notifications.id, notice.id));
    expect(discussionPushReceipt(settled.data)).toBe("queued");
    await notificationRepository.markAsRead(notice.id, reader.id);
    expect(
      (
        await notificationRepository.createDiscussionReplyWithPush({
          recipientId: reader.id,
          contentId: item.id,
          commentId: event.id,
          repairPush: true,
        })
      ).pushJobs,
    ).toBe(0);
  } finally {
    await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON notifications`));
    await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${functionName}()`));
  }
});
