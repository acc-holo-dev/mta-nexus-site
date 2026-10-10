import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  publicationFeedRepository as feed,
  discussionManagementRepository as management,
  discussionRevision,
  userRepository,
} from "@nexus/db";
import {
  auditEvents,
  comments,
  content,
  follows,
  organizations,
  servers,
  users,
} from "../packages/db/src/schema";
const actors: string[] = [],
  orgs: string[] = [],
  serverIds: string[] = [];
afterEach(async () => {
  if (actors.length) await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
  if (serverIds.length) await db.delete(servers).where(inArray(servers.id, serverIds));
  if (orgs.length) await db.delete(organizations).where(inArray(organizations.id, orgs));
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  orgs.length = 0;
  serverIds.length = 0;
});
async function actor(role = "user") {
  const suffix = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_feed_${suffix}`,
    email: `feed_${suffix}@nexus.test`,
    username: `feed_${suffix}`,
    displayName: "Writer",
    role,
  });
  actors.push(user.id);
  return user;
}
async function publication(authorId: string, extra = {}) {
  const id = `cnt_feed_${randomUUID()}`;
  const [row] = await db
    .insert(content)
    .values({
      id,
      title: "Public title",
      slug: `feed-${randomUUID()}`,
      body: "Body",
      authorId,
      type: "article",
      ...extra,
    })
    .returning();
  return row;
}
async function comment(publicationId: string, authorId: string, extra = {}) {
  const [row] = await db
    .insert(comments)
    .values({
      id: `cmt_feed_${randomUUID()}`,
      contentId: publicationId,
      authorId,
      text: "Original",
      ...extra,
    })
    .returning();
  await db
    .update(content)
    .set({ commentCount: sql`${content.commentCount} + 1` })
    .where(eq(content.id, publicationId));
  return row;
}
function command(
  publication: { slug: string },
  comment: { id: string; text: string },
  actorId: string,
  extra = {},
) {
  return {
    slug: publication.slug,
    commentId: comment.id,
    actorId,
    expectedRevision: discussionRevision(comment.id, comment.text),
    auditId: `aud_feed_${randomUUID()}`,
    ...extra,
  };
}
it("deduplicates a publication matched by author and organization, excludes drafts and other actors", async () => {
  const follower = await actor(),
    author = await actor(),
    other = await actor();
  const orgId = `org_feed_${randomUUID()}`;
  orgs.push(orgId);
  await db
    .insert(organizations)
    .values({ id: orgId, name: "Team", slug: `feed-${randomUUID()}`, ownerId: author.id });
  const publicItem = await publication(author.id, { organizationId: orgId });
  await publication(author.id, { status: "draft" });
  await publication(other.id);
  await db.insert(follows).values([
    { id: `fol_${randomUUID()}`, followerId: follower.id, targetType: "user", targetId: author.id },
    {
      id: `fol_${randomUUID()}`,
      followerId: follower.id,
      targetType: "organization",
      targetId: orgId,
    },
  ]);
  expect(
    (await feed.page({ kind: "following", actorId: follower.id })).items.map((row) => row.id),
  ).toEqual([publicItem.id]);
  expect((await feed.page({ kind: "following", actorId: other.id })).items).toHaveLength(0);
});
it("traverses equal-microsecond publication keys exactly once", async () => {
  const author = await actor();
  const items = await Promise.all(Array.from({ length: 45 }, () => publication(author.id)));
  await db
    .update(content)
    .set({ publishedAt: sql`'2026-10-10T12:00:00.123456Z'::timestamptz` })
    .where(eq(content.authorId, author.id));
  const found: string[] = [];
  let cursor: { createdAt: string; id: string } | undefined;
  for (let index = 0; index < 4; index++) {
    const page = await feed.page({ kind: "user", id: author.id }, { cursor });
    found.push(...page.items.map((row) => row.id));
    if (!page.nextCursor) break;
    expect(page.nextCursor.createdAt).toBe("2026-10-10T12:00:00.123456Z");
    cursor = page.nextCursor;
  }
  expect(found).toEqual(
    items
      .map((row) => row.id)
      .sort()
      .reverse(),
  );
  expect(new Set(found).size).toBe(45);
});
it("removes private server affiliations and stops matching a revoked public server", async () => {
  const follower = await actor(),
    author = await actor();
  const serverId = `srv_feed_${randomUUID()}`;
  serverIds.push(serverId);
  await db
    .insert(servers)
    .values({
      id: serverId,
      name: "Private marker",
      slug: `feed-${randomUUID()}`,
      ipAddress: `feed-${randomUUID()}.test`,
      port: 22003,
      visibility: "public",
    });
  await publication(author.id, { serverId });
  await db
    .insert(follows)
    .values({
      id: `fol_${randomUUID()}`,
      followerId: follower.id,
      targetType: "server",
      targetId: serverId,
    });
  expect((await feed.page({ kind: "following", actorId: follower.id })).items).toHaveLength(1);
  await db.update(servers).set({ visibility: "private" }).where(eq(servers.id, serverId));
  expect((await feed.page({ kind: "following", actorId: follower.id })).items).toHaveLength(0);
  expect((await feed.page({ kind: "user", id: author.id })).items[0].serverName).toBeNull();
});
it("allows only one concurrent edit of the same revision and preserves publication metadata", async () => {
  const author = await actor(),
    item = await publication(author.id),
    message = await comment(item.id, author.id);
  const results = await Promise.allSettled(
    ["First edit", "Second edit"].map((text) =>
      management.mutate(command(item, message, author.id, { text })),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "COMMENT_CHANGED" },
  });
  const [stored] = await db.select().from(content).where(eq(content.id, item.id));
  expect(stored.updatedAt).toEqual(item.updatedAt);
  expect(stored.commentCount).toBe(1);
});
it("removes only the scoped comment, retains replies and writes one private-text-free audit", async () => {
  const author = await actor(),
    moderator = await actor("moderator"),
    item = await publication(author.id),
    parent = await comment(item.id, author.id),
    reply = await comment(item.id, author.id, { parentId: parent.id });
  await management.mutate(command(item, parent, moderator.id, { reason: "Spam" }));
  expect(await db.select().from(comments).where(eq(comments.id, parent.id))).toHaveLength(0);
  expect(await db.select().from(comments).where(eq(comments.id, reply.id))).toHaveLength(1);
  const [stored] = await db.select().from(content).where(eq(content.id, item.id));
  expect(stored.commentCount).toBe(1);
  const audits = await db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.actorId, moderator.id), eq(auditEvents.targetId, parent.id)));
  expect(audits).toHaveLength(1);
  expect(JSON.stringify(audits)).not.toContain("Original");
});
it("denies revoked moderator permissions and rolls back writes when audit insertion fails", async () => {
  const author = await actor(),
    moderator = await actor("moderator"),
    item = await publication(author.id),
    message = await comment(item.id, author.id);
  await db.update(users).set({ role: "user" }).where(eq(users.id, moderator.id));
  await expect(
    management.mutate(command(item, message, moderator.id, { reason: "Spam" })),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const auditId = `aud_feed_${randomUUID()}`;
  await db
    .insert(auditEvents)
    .values({
      id: auditId,
      actorId: author.id,
      actorType: "user",
      action: "fixture",
      targetType: "comment",
      targetId: message.id,
    });
  await expect(
    management.mutate(command(item, message, author.id, { text: "Should roll back", auditId })),
  ).rejects.toThrow();
  const [stored] = await db.select().from(comments).where(eq(comments.id, message.id));
  expect(stored.text).toBe("Original");
});
