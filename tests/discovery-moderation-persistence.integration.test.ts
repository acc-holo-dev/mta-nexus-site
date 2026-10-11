import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  users,
  organizations,
  servers,
  content,
  auditEvents,
  notifications,
  userRepository,
  publicDirectoryRepository as directory,
  communityModerationWorkspaceRepository as workspace,
  contentRepository as moderation,
} from "@nexus/db";
const actors: string[] = [],
  orgs: string[] = [],
  serverIds: string[] = [];
const time = "2026-10-11T00:00:00.123456Z";
afterEach(async () => {
  if (actors.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    await db.delete(content).where(inArray(content.authorId, actors));
  }
  if (serverIds.length) await db.delete(servers).where(inArray(servers.id, serverIds));
  if (orgs.length) await db.delete(organizations).where(inArray(organizations.id, orgs));
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  orgs.length = 0;
  serverIds.length = 0;
});
async function actor(role = "user") {
  const key = randomUUID().replaceAll("-", "");
  const value = await userRepository.create({
    id: `usr_dm_${key}`,
    username: `dm_${key}`,
    displayName: "Fixture",
    email: `${key}@nexus.test`,
    role,
  });
  actors.push(value.id);
  return value;
}
async function item(authorId: string, extra: Partial<typeof content.$inferInsert> = {}) {
  const [value] = await db
    .insert(content)
    .values({
      id: `cnt_${randomUUID()}`,
      slug: `dm-${randomUUID()}`,
      authorId,
      title: "Reviewed publication",
      body: "Reviewed body",
      type: "post",
      status: "draft",
      ...extra,
    })
    .returning();
  return value;
}
const audit = (actorId: string, targetId: string, id = `aud_${randomUUID()}`) => ({
  id,
  actorId,
  actorType: "admin" as const,
  targetType: "content",
  targetId,
  action: "content.published",
  details: { from: "draft", to: "published", notes: "Reviewed reason" },
});
it("traverses creator and organization microsecond streams across multiple pages, and returns nearest newer neighbors", async () => {
  const owner = await actor(),
    marker = randomUUID(),
    people = Array.from({ length: 53 }, (_, i) => {
      const key = randomUUID().replaceAll("-", "");
      return {
        id: `usr_dm_${key}`,
        username: `dm_${key}`,
        email: `${key}@nexus.test`,
        displayName: marker,
        role: i === 0 ? "admin" : "developer",
        createdAt: sql`${time}::timestamptz`,
      };
    });
  actors.push(...people.map((person) => person.id));
  await db.insert(users).values(people);
  const teams = Array.from({ length: 53 }, () => ({
    id: `org_dm_${randomUUID()}`,
    slug: `dm-${randomUUID()}`,
    name: marker,
    ownerId: owner.id,
    createdAt: sql`${time}::timestamptz`,
  }));
  orgs.push(...teams.map((team) => team.id));
  await db.insert(organizations).values(teams);
  for (const [method, expected] of [
    ["pageCreators", people.map((person) => person.id)],
    ["pageOrganizations", teams.map((team) => team.id)],
  ] as const) {
    const found: string[] = [];
    let cursor: { createdAt: string; id: string } | undefined;
    const first = await directory[method]({ keyset: true, query: marker });
    for (let page = 0; page < 4; page++) {
      const result = await directory[method]({ keyset: true, query: marker, cursor });
      found.push(...result.items.map((row) => row.id));
      if (!result.nextCursor) break;
      expect(result.nextCursor.createdAt).toBe(time);
      cursor = result.nextCursor;
    }
    expect(found).toEqual([...expected].sort().reverse());
    expect(new Set(found).size).toBe(53);
    if (!first.nextCursor) throw Error("Expected continuation");
    const second = await directory[method]({
      keyset: true,
      query: marker,
      cursor: first.nextCursor,
    });
    if (!second.previousCursor) throw Error("Expected return continuation");
    const previous = await directory[method]({
      keyset: true,
      query: marker,
      cursor: { ...second.previousCursor, direction: "newer" },
    });
    expect(previous.items.map((row) => row.id)).toEqual(first.items.map((row) => row.id));
  }
});
it("keeps server gates and narrow public projection when a saved public server becomes private", async () => {
  const owner = await actor(),
    marker = randomUUID(),
    records = ["public", "private", "unlisted"].map((visibility) => ({
      id: `srv_dm_${randomUUID()}`,
      slug: `dm-${randomUUID()}`,
      name: marker,
      ipAddress: `fixture-${randomUUID()}`,
      visibility,
      ownerId: owner.id,
      createdAt: sql`${time}::timestamptz`,
    }));
  serverIds.push(...records.map((row) => row.id));
  await db.insert(servers).values(records);
  await db.insert(servers).values({
    id: `${serverIds[0]}-inactive`,
    slug: `dm-${randomUUID()}`,
    name: marker,
    ipAddress: `fixture-${randomUUID()}`,
    status: "inactive",
  });
  serverIds.push(`${serverIds[0]}-inactive`);
  const page = await directory.pageServers({ keyset: true, query: marker });
  expect(page.items.map((row) => row.id)).toEqual([records[0].id]);
  expect(JSON.stringify(page.items)).not.toMatch(
    /ownerId|organizationId|endpointRevision|currentPlayers|observationSource/u,
  );
  await db.update(servers).set({ visibility: "private" }).where(eq(servers.id, records[0].id));
  expect((await directory.pageServers({ keyset: true, query: marker })).items).toHaveLength(0);
});
it("traverses exact updated publication keys under live staff authority and rejects cross-filter/account continuations", async () => {
  const author = await actor(),
    moderator = await actor("moderator"),
    other = await actor("admin"),
    marker = randomUUID();
  const rows = Array.from({ length: 45 }, () => ({
    id: `cnt_${randomUUID()}`,
    slug: `dm-${randomUUID()}`,
    authorId: author.id,
    title: marker,
    body: "Draft review",
    type: "post",
    status: "draft",
    updatedAt: sql`${time}::timestamptz`,
  }));
  await db.insert(content).values(rows);
  const first = await workspace.page(moderator.id, { query: marker, status: "draft" }),
    ids: string[] = [];
  let cursor: { createdAt: string; id: string; context: string } | undefined;
  for (let i = 0; i < 4; i++) {
    const page = await workspace.page(moderator.id, { query: marker, status: "draft", cursor });
    ids.push(...page.items.map((row) => row.id));
    if (!page.nextCursor) break;
    expect(page.nextCursor.createdAt).toBe(time);
    cursor = { ...page.nextCursor, context: page.context };
  }
  expect(ids).toEqual(
    rows
      .map((row) => row.id)
      .sort()
      .reverse(),
  );
  if (!first.nextCursor) throw Error("Expected continuation");
  const bound = { ...first.nextCursor, context: first.context };
  await expect(
    workspace.page(other.id, { query: marker, status: "draft", cursor: bound }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  await expect(
    workspace.page(moderator.id, { query: marker, status: "published", cursor: bound }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  await db.update(users).set({ role: "user" }).where(eq(users.id, moderator.id));
  await expect(
    workspace.page(moderator.id, { query: marker, status: "draft" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("retains only publication moderation decisions with exact history keys and excludes raw audit evidence", async () => {
  const author = await actor(),
    moderator = await actor("moderator"),
    publication = await item(author.id),
    other = await item(author.id);
  const events = Array.from({ length: 43 }, () => ({
    ...audit(moderator.id, publication.id),
    createdAt: sql`${time}::timestamptz`,
    ipAddress: "PRIVATE_IP",
    userAgent: "PRIVATE_AGENT",
  }));
  await db
    .insert(auditEvents)
    .values([
      ...events,
      { ...audit(moderator.id, publication.id), action: "content.edited_by_author" },
      { ...audit(moderator.id, other.id) },
    ]);
  const ids: string[] = [];
  let cursor: { createdAt: string; id: string; context: string } | undefined;
  for (let i = 0; i < 4; i++) {
    const page = await workspace.detail(moderator.id, publication.id, cursor);
    ids.push(...page.history.map((row) => row.id));
    expect(JSON.stringify(page.history)).not.toMatch(
      /PRIVATE_IP|PRIVATE_AGENT|ipAddress|actorId|userAgent/u,
    );
    if (!page.nextCursor) break;
    expect(page.nextCursor.createdAt).toBe(time);
    cursor = { ...page.nextCursor, context: page.context };
  }
  expect(ids).toEqual(
    events
      .map((row) => row.id)
      .sort()
      .reverse(),
  );
  if (!cursor) throw Error("Expected history continuation");
  await expect(workspace.detail(moderator.id, other.id, cursor)).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
});
it("preserves atomic audit/author notice semantics, live roles, publication scope and complete Unicode preview limits", async () => {
  const author = await actor(),
    moderator = await actor("moderator"),
    publication = await item(author.id),
    duplicate = audit(moderator.id, publication.id);
  await db.insert(auditEvents).values(duplicate);
  await expect(
    moderation.moderateStatusWithAudit(
      publication.id,
      "published",
      "draft",
      duplicate,
      publication.updatedAt,
      true,
    ),
  ).rejects.toThrow();
  expect((await workspace.detail(moderator.id, publication.id)).item.status).toBe("draft");
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, author.id)),
  ).toHaveLength(0);
  await db.update(content).set({ type: "resource" }).where(eq(content.id, publication.id));
  await expect(
    moderation.moderateStatusWithAudit(
      publication.id,
      "published",
      "draft",
      audit(moderator.id, publication.id),
      publication.updatedAt,
      true,
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await db
    .update(content)
    .set({ type: "post", body: "x".repeat(100001) })
    .where(eq(content.id, publication.id));
  expect((await workspace.detail(moderator.id, publication.id)).item.truncated).toBe(true);
  await expect(
    moderation.moderateStatusWithAudit(
      publication.id,
      "published",
      "draft",
      audit(moderator.id, publication.id),
      publication.updatedAt,
      true,
    ),
  ).rejects.toMatchObject({ code: "CONTENT_REVIEW_TOO_LARGE" });
  await db
    .update(content)
    .set({ body: "😀".repeat(60000) })
    .where(eq(content.id, publication.id));
  expect((await workspace.detail(moderator.id, publication.id)).item.truncated).toBe(false);
  expect(
    await moderation.moderateStatusWithAudit(
      publication.id,
      "published",
      "draft",
      audit(moderator.id, publication.id),
      publication.updatedAt,
      true,
    ),
  ).toMatchObject({ status: "published" });
  await db.update(users).set({ role: "user" }).where(eq(users.id, moderator.id));
  await expect(
    moderation.moderateStatusWithAudit(
      publication.id,
      "archived",
      "published",
      audit(moderator.id, publication.id),
      undefined,
      true,
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
