import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import {
  db,
  discussionWorkspaceRepository as own,
  discussionManagementRepository as management,
  discussionRevision,
  publicVerificationHistoryRepository as history,
  userRepository,
  auditEvents,
  comments,
  content,
  notificationPreferences,
  notifications,
  users,
  verificationRequests,
} from "@nexus/db";
const actors: string[] = [];
afterEach(async () => {
  if (actors.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    await db.delete(content).where(inArray(content.authorId, actors));
    await db.delete(users).where(inArray(users.id, actors));
  }
  actors.length = 0;
});
async function actor(role = "user") {
  const key = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_disc_${key}`,
    username: `disc_${key}`,
    email: `${key}@nexus.test`,
    displayName: "Writer",
    role,
  });
  actors.push(user.id);
  return user;
}
async function publication(authorId: string, status = "published") {
  const [item] = await db
    .insert(content)
    .values({
      id: `cnt_${randomUUID()}`,
      slug: `discussion-${randomUUID()}`,
      title: "Private title marker",
      body: "Private parent body",
      authorId,
      type: "post",
      status,
    })
    .returning();
  return item;
}
async function comment(contentId: string, authorId: string, extra = {}) {
  const [row] = await db
    .insert(comments)
    .values({ id: `cmt_${randomUUID()}`, contentId, authorId, text: "Own original text", ...extra })
    .returning();
  await db
    .update(content)
    .set({ commentCount: sql`${content.commentCount} + 1` })
    .where(eq(content.id, contentId));
  return row;
}
function command(message: { id: string; text: string }, actorId: string, extra = {}) {
  return {
    commentId: message.id,
    actorId,
    expectedRevision: discussionRevision(message.id, message.text),
    auditId: `aud_${randomUUID()}`,
    ...extra,
  };
}
it("hides archived parent context, cannot search private titles, and never allows foreign administrator cleanup", async () => {
  const author = await actor(),
    admin = await actor("admin"),
    item = await publication(author.id, "archived"),
    message = await comment(item.id, author.id);
  const row = await own.find(author.id, message.id);
  expect(row).toMatchObject({
    text: message.text,
    title: null,
    slug: null,
    type: null,
    available: false,
    editable: false,
  });
  expect((await own.page(author.id, { query: "Private title marker" })).items).toHaveLength(0);
  expect((await own.page(author.id, { query: "Own original" })).items).toHaveLength(1);
  await expect(own.find(admin.id, message.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(own.mutate(command(message, admin.id))).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    own.mutate(command(message, author.id, { text: "Denied edit" })),
  ).rejects.toMatchObject({ code: "DISCUSSION_UNAVAILABLE" });
});
it("removes an own archived comment, retaining replies and exact parent revision metadata", async () => {
  const author = await actor(),
    item = await publication(author.id, "archived"),
    parent = await comment(item.id, author.id),
    reply = await comment(item.id, author.id, { parentId: parent.id });
  await own.mutate(command(parent, author.id));
  expect(await db.select().from(comments).where(eq(comments.id, parent.id))).toHaveLength(0);
  expect(await db.select().from(comments).where(eq(comments.id, reply.id))).toHaveLength(1);
  const [stored] = await db.select().from(content).where(eq(content.id, item.id));
  expect(stored).toMatchObject({
    commentCount: 1,
    status: "archived",
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt,
  });
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, author.id)),
  ).toHaveLength(0);
});
it("accepts one concurrent own edit per saved revision and rechecks live moderator permissions", async () => {
  const author = await actor(),
    moderator = await actor("moderator"),
    item = await publication(author.id),
    message = await comment(item.id, author.id);
  const results = await Promise.allSettled(
    ["First edit", "Second edit"].map((text) => own.mutate(command(message, author.id, { text }))),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "COMMENT_CHANGED" },
  });
  const updated = await own.find(author.id, message.id);
  await db.update(users).set({ role: "user" }).where(eq(users.id, moderator.id));
  await expect(
    management.mutate({
      ...command({ ...message, text: updated.text }, moderator.id),
      slug: item.slug,
      reason: "Spam",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("commits status-only moderator notices with deletion/audit and respects recipient content opt-out", async () => {
  const author = await actor(),
    moderator = await actor("moderator"),
    item = await publication(author.id),
    message = await comment(item.id, author.id);
  const input = {
    ...command(message, moderator.id),
    slug: item.slug,
    reason: "Private moderation reason",
  };
  await management.mutate(input);
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, author.id));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    id: `ntf_discussion_${createHash("sha256")
      .update(JSON.stringify([input.auditId, author.id]))
      .digest("hex")}`,
    title: "Discussion moderation",
    message: `Comment ${message.id}: removed.`,
    link: `/articles/${item.slug}#discussion`,
    category: "content",
  });
  expect(JSON.stringify(rows)).not.toMatch(
    /Own original text|Private moderation reason|Private title marker/u,
  );
  await db
    .insert(notificationPreferences)
    .values({ id: `pref_${randomUUID()}`, userId: author.id, contentEnabled: false });
  const other = await comment(item.id, author.id);
  await management.mutate({ ...command(other, moderator.id), slug: item.slug, reason: "Spam" });
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, author.id)),
  ).toHaveLength(1);
});
it("rolls back deletion, counter and notice when mandatory audit insertion fails", async () => {
  const author = await actor(),
    moderator = await actor("moderator"),
    item = await publication(author.id),
    message = await comment(item.id, author.id);
  const input = { ...command(message, moderator.id), slug: item.slug, reason: "Spam" };
  await db
    .insert(auditEvents)
    .values({
      id: input.auditId,
      actorId: moderator.id,
      action: "fixture",
      targetType: "comment",
      targetId: message.id,
    });
  await expect(management.mutate(input)).rejects.toThrow();
  expect(await db.select().from(comments).where(eq(comments.id, message.id))).toHaveLength(1);
  const [stored] = await db.select().from(content).where(eq(content.id, item.id));
  expect(stored.commentCount).toBe(1);
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, author.id)),
  ).toHaveLength(0);
});
it("traverses exact microsecond own-comment and public-approval keys without duplicates or private application fields", async () => {
  const author = await actor(),
    other = await actor(),
    item = await publication(author.id);
  const time = "2026-10-11T00:00:00.123456Z";
  const messages = Array.from({ length: 45 }, (_, i) => ({
    id: `cmt_${i}_${randomUUID()}`,
    contentId: item.id,
    authorId: author.id,
    text: `Own ${i}`,
    createdAt: sql`${time}::timestamptz`,
  }));
  await db.insert(comments).values(messages);
  const found: string[] = [];
  let cursor: { createdAt: string; id: string } | undefined;
  for (let i = 0; i < 4; i++) {
    const page = await own.page(author.id, { query: "", cursor });
    found.push(...page.items.map((row) => row.id));
    if (!page.nextCursor) break;
    expect(page.nextCursor.createdAt).toBe(time);
    cursor = page.nextCursor;
  }
  expect(found).toEqual(
    messages
      .map((row) => row.id)
      .sort()
      .reverse(),
  );
  const requests = Array.from({ length: 45 }, (_, i) => ({
    id: `vrf_${i}_${randomUUID()}`,
    requesterId: author.id,
    targetId: author.id,
    targetType: i % 2 ? "developer" : "user",
    status: "approved",
    resolvedAt: sql`${time}::timestamptz`,
    proofUrl: "https://private.test/evidence",
    reviewNotes: "private evidence notes",
  }));
  await db
    .insert(verificationRequests)
    .values([
      ...requests,
      ...["pending", "rejected"].map((status) => ({
        ...requests[0],
        id: `vrf_${randomUUID()}`,
        status,
      })),
      { ...requests[0], id: `vrf_${randomUUID()}`, resolvedAt: null },
      { ...requests[0], id: `vrf_${randomUUID()}`, targetType: "organization" },
    ]);
  const keys: string[] = [];
  let approvalCursor: { createdAt: string; id: string; context: string } | undefined;
  for (let i = 0; i < 4; i++) {
    const page = await history.page(author.username, { cursor: approvalCursor });
    keys.push(...page.items.map((row) => row.key));
    expect(page.subject.identityVerified).toBe(false);
    expect(JSON.stringify(page)).not.toMatch(/private evidence|proofUrl|reviewNotes|vrf_/u);
    if (!page.nextCursor) break;
    expect(page.nextCursor.createdAt).toBe(time);
    approvalCursor = { ...page.nextCursor, context: page.context };
  }
  expect(keys).toEqual(
    requests
      .map((row) => createHash("md5").update(row.id).digest("hex"))
      .sort()
      .reverse(),
  );
  if (!approvalCursor) throw new Error("Expected continuation");
  await expect(history.page(other.username, { cursor: approvalCursor })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  await expect(
    history.page(author.username, { type: "developer", cursor: approvalCursor }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(
    (await history.page(author.username, { type: "developer" })).items.every(
      (row) => row.type === "developer",
    ),
  ).toBe(true);
  expect(
    await db
      .select()
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.targetId, author.id),
          eq(verificationRequests.status, "approved"),
        ),
      ),
  ).toHaveLength(47);
});
