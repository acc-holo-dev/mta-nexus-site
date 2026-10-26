import { randomUUID } from "node:crypto";
import {
  authorContentRepository as author,
  contentRepository,
  db,
  publicationFeedRepository as feed,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import type { Content, User } from "@nexus/domain";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import {
  auditEvents,
  comments,
  content,
  follows,
  organizationMembers,
  organizations,
  userProfilePreferences,
  users,
} from "../packages/db/src/schema";

const actors: string[] = [],
  teams: string[] = [];
afterEach(async () => {
  if (actors.length) await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
  if (teams.length) await db.delete(organizations).where(inArray(organizations.id, teams));
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  teams.length = 0;
});
async function user() {
  const suffix = randomUUID().replaceAll("-", "");
  const actor = await userRepository.create({
    id: `usr_author_desk_${suffix}`,
    username: `author_desk_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Studio writer",
  });
  actors.push(actor.id);
  return actor;
}
async function publication(actor: User, organizationId?: string) {
  return contentRepository.create({
    id: `cnt_author_desk_${randomUUID()}`,
    slug: `author-desk-${randomUUID()}`,
    authorId: actor.id,
    organizationId,
    title: "Original title",
    body: "Original text that restoration must preserve.",
    excerpt: "Original excerpt",
    type: "article",
    status: "published",
    tags: ["Lua"],
    viewCount: 7,
    likeCount: 2,
    commentCount: 0,
    publishedAt: new Date(),
  });
}
const audit = (actor: User, item: Pick<Content, "id">, action = "content.archived_by_author") => ({
  id: `aud_author_desk_${randomUUID()}`,
  actorId: actor.id,
  actorType: "user" as const,
  action,
  targetId: item.id,
  targetType: "content",
});
async function archive(actor: User, item: Content, action = "content.archived_by_author") {
  await author.mutate(
    item.id,
    actor.id,
    item.updatedAt,
    item.status,
    null,
    audit(actor, item, action),
  );
  return author.history(item.id, actor.id);
}
const filters = { query: "", tag: "", status: "all", type: "all", source: "all" };
it("restores exactly one author-owned revision to a private draft without deleting text, counts or replies", async () => {
  const actor = await user(),
    foreign = await user(),
    item = await publication(actor);
  await contentRepository.addComment({
    id: `cmt_author_desk_${randomUUID()}`,
    contentId: item.id,
    authorId: foreign.id,
    text: "Existing reply",
    isVerifiedPurchase: false,
  });
  const current = await author.findAuthored(item.id, actor.id);
  if (!current) throw Error("Missing fixture");
  const archived = await archive(actor, current);
  expect(archived.item.recoverable).toBe(true);
  expect(archived.item.revision).toMatch(/\.\d{6}Z$/u);
  const saved = await author.restore(
    item.id,
    actor.id,
    archived.item.revision,
    audit(actor, item, "content.restored_by_author"),
  );
  expect(saved.status).toBe("draft");
  expect(saved.revision > archived.item.revision).toBe(true);
  expect(await author.findAuthored(item.id, actor.id)).toMatchObject({
    body: item.body,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    tags: item.tags,
    viewCount: 7,
    likeCount: 2,
    commentCount: 1,
    status: "draft",
    publishedAt: null,
  });
  expect(
    await contentRepository.findPublishedBySlug(item.slug, { incrementView: false }),
  ).toBeNull();
  expect(
    await db.select({ id: comments.id }).from(comments).where(eq(comments.contentId, item.id)),
  ).toHaveLength(1);
  await expect(
    author.restore(item.id, actor.id, archived.item.revision, audit(actor, item)),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(author.history(item.id, foreign.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    author.restore(item.id, foreign.id, saved.revision, audit(foreign, item)),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("rolls back the status and recovery proof when mandatory audit persistence fails", async () => {
  const actor = await user(),
    item = await publication(actor),
    archived = await archive(actor, item);
  const [existing] = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(eq(auditEvents.targetId, item.id));
  if (!existing) throw Error("Missing archive audit");
  await expect(
    author.restore(item.id, actor.id, archived.item.revision, {
      ...audit(actor, item),
      id: existing.id,
    }),
  ).rejects.toBeDefined();
  const unchanged = await author.history(item.id, actor.id);
  expect(unchanged.item).toMatchObject({
    status: "archived",
    revision: archived.item.revision,
    recoverable: true,
  });
  expect(unchanged.events).toHaveLength(1);
  expect(
    (await author.restore(item.id, actor.id, archived.item.revision, audit(actor, item))).status,
  ).toBe("draft");
});
it("denies retained legacy and team archives and never reverses a subsequent moderation archive", async () => {
  const actor = await user(),
    moderator = await user();
  await db.update(users).set({ role: "moderator" }).where(eq(users.id, moderator.id));
  await sessionRepository.create({
    id: `ses_${moderator.id}`,
    userId: moderator.id,
    token: `tok_${moderator.id}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const legacy = await publication(actor),
    team = await publication(actor),
    item = await publication(actor);
  for (const [target, action] of [
    [legacy, "content.archived"],
    [team, "content.archived_by_organization"],
  ] as const) {
    const archived = await archive(actor, target, action);
    expect(archived.item.recoverable).toBe(false);
    await expect(
      author.restore(target.id, actor.id, archived.item.revision, audit(actor, target)),
    ).rejects.toMatchObject({ code: "PUBLICATION_RESTORE_DENIED" });
  }
  const ownArchive = await archive(actor, item),
    current = await author.findAuthored(item.id, actor.id);
  if (!current) throw Error("Missing current archive");
  await contentRepository.moderateStatusWithAudit(
    item.id,
    "archived",
    "archived",
    {
      ...audit(moderator, item, "content.archived"),
      details: { from: "archived", to: "archived", notes: "PRIVATE_STAFF_REASON" },
    },
    `tok_${moderator.id}`,
    current.updatedAt,
    true,
  );
  const afterStaff = await author.history(item.id, actor.id);
  expect(afterStaff.item.recoverable).toBe(false);
  expect(afterStaff.item.revision > ownArchive.item.revision).toBe(true);
  expect(JSON.stringify(afterStaff)).not.toContain("PRIVATE_STAFF_REASON");
  await expect(
    author.restore(item.id, actor.id, afterStaff.item.revision, audit(actor, item)),
  ).rejects.toMatchObject({ code: "PUBLICATION_RESTORE_DENIED" });
});
it("rechecks revoked organization membership before restoring or emitting an audit", async () => {
  const owner = await user(),
    actor = await user(),
    id = `org_author_desk_${randomUUID()}`;
  teams.push(id);
  await db
    .insert(organizations)
    .values({ id, ownerId: owner.id, name: "Studio team", slug: `author-desk-${randomUUID()}` });
  await db.insert(organizationMembers).values({
    id: `orgm_author_desk_${randomUUID()}`,
    organizationId: id,
    userId: actor.id,
    role: "developer",
  });
  const item = await publication(actor, id),
    archived = await archive(actor, item);
  await db
    .update(organizationMembers)
    .set({ role: "member" })
    .where(eq(organizationMembers.userId, actor.id));
  await expect(
    author.restore(item.id, actor.id, archived.item.revision, audit(actor, item)),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await author.history(item.id, actor.id)).item).toMatchObject({
    status: "archived",
    revision: archived.item.revision,
  });
  expect(
    await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(eq(auditEvents.targetId, item.id)),
  ).toHaveLength(1);
});
it("traverses equal-microsecond authored summaries in both directions and continues without deleted anchors", async () => {
  const actor = await user(),
    foreign = await user();
  const ids = Array.from({ length: 45 }, () => `cnt_author_desk_${randomUUID()}`);
  await db.insert(content).values(
    ids.map((id) => ({
      id,
      slug: `author-desk-${randomUUID()}`,
      authorId: actor.id,
      title: "Literal %_ match",
      body: "A complete body",
      type: "article",
      status: "draft",
      tags: ["Lua"],
      updatedAt: sql`'2026-10-11T00:00:00.123456Z'::timestamptz`,
    })),
  );
  await publication(foreign);
  const first = await author.desk(actor.id, filters),
    second = await author.desk(actor.id, {
      ...filters,
      cursor: JSON.parse(first.olderCursor ?? ""),
    }),
    third = await author.desk(actor.id, {
      ...filters,
      cursor: JSON.parse(second.olderCursor ?? ""),
    });
  expect([...first.items, ...second.items, ...third.items].map((item) => item.id)).toEqual(
    ids.sort().reverse(),
  );
  expect(first.items[0].updatedAt).toBe("2026-10-11T00:00:00.123456Z");
  const back = await author.desk(actor.id, {
    ...filters,
    cursor: JSON.parse(third.newerCursor ?? ""),
  });
  expect(back.items.map((item) => item.id)).toEqual(second.items.map((item) => item.id));
  await db.delete(content).where(eq(content.id, first.items.at(-1)?.id ?? ""));
  const continued = await author.desk(actor.id, {
    ...filters,
    cursor: JSON.parse(first.olderCursor ?? ""),
  });
  expect(continued.items.map((item) => item.id)).toEqual(second.items.map((item) => item.id));
  expect(
    (await author.desk(actor.id, { ...filters, query: "%_", tag: "LUA", status: "draft" })).items,
  ).toHaveLength(20);
  await expect(
    author.desk(foreign.id, { ...filters, cursor: JSON.parse(first.olderCursor ?? "") }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
});
it("reads only a currently followed exact author and rechecks unfollow and activity privacy", async () => {
  const reader = await user(),
    selected = await user(),
    other = await user(),
    selectedPost = await publication(selected);
  await publication(other);
  await db.insert(follows).values([
    {
      id: `fol_author_desk_${randomUUID()}`,
      followerId: reader.id,
      targetType: "user",
      targetId: selected.id,
    },
    {
      id: `fol_author_desk_${randomUUID()}`,
      followerId: reader.id,
      targetType: "user",
      targetId: other.id,
    },
  ]);
  const scope = { kind: "following" as const, actorId: reader.id },
    query = { source: "user" as const, target: selected.id };
  expect((await feed.page(scope, query)).items.map((item) => item.id)).toEqual([selectedPost.id]);
  expect((await feed.page({ ...scope, actorId: other.id }, query)).items).toHaveLength(0);
  await db
    .insert(userProfilePreferences)
    .values({ userId: selected.id, showActivity: false })
    .onConflictDoUpdate({ target: userProfilePreferences.userId, set: { showActivity: false } });
  expect((await feed.page(scope, query)).items).toHaveLength(0);
  await db
    .update(userProfilePreferences)
    .set({ showActivity: true })
    .where(eq(userProfilePreferences.userId, selected.id));
  await db.delete(follows).where(eq(follows.targetId, selected.id));
  expect((await feed.page(scope, query)).items).toHaveLength(0);
});
