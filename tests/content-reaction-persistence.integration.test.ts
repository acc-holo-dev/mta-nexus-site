import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  contentReactionsRepository as repository,
  publicUserTrustRepository,
  contentRepository,
  userRepository,
} from "@nexus/db";
import {
  auditEvents,
  content,
  developerProfiles,
  notificationPreferences,
  notifications,
  organizations,
  reactions,
  servers,
  userProfilePreferences,
  users,
  verificationRequests,
} from "../packages/db/src/schema";
import { contentReactionService } from "../apps/web/src/lib/services/content-reaction-service";
import { parseReactionPage } from "../apps/web/src/lib/content-reaction-contract";
const actorIds: string[] = [],
  contentIds: string[] = [],
  organizationIds: string[] = [],
  serverIds: string[] = [];
afterEach(async () => {
  if (contentIds.length) {
    await db.delete(reactions).where(inArray(reactions.targetId, contentIds));
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, contentIds));
    await db.delete(content).where(inArray(content.id, contentIds));
  }
  if (serverIds.length) await db.delete(servers).where(inArray(servers.id, serverIds));
  if (organizationIds.length)
    await db.delete(organizations).where(inArray(organizations.id, organizationIds));
  if (actorIds.length) await db.delete(users).where(inArray(users.id, actorIds));
  actorIds.length = contentIds.length = organizationIds.length = serverIds.length = 0;
});
async function actor() {
  const suffix = randomUUID().replaceAll("-", "");
  const result = await userRepository.create({
    id: `usr_reaction_${suffix}`,
    email: `${suffix}@nexus.test`,
    username: `reaction_${suffix}`,
    displayName: "Reaction writer",
  });
  actorIds.push(result.id);
  return result;
}
async function publication(authorId: string, extra = {}) {
  const id = `cnt_reaction_${randomUUID()}`;
  contentIds.push(id);
  const [row] = await db
    .insert(content)
    .values({
      id,
      slug: `reaction-${randomUUID()}`,
      authorId,
      type: "article",
      status: "published",
      title: "Public guide",
      body: "Body",
      ...extra,
    })
    .returning();
  return row;
}
const command = (
  actorId: string,
  slug: string,
  reaction: "helpful" | "thanks" | "insight" | null,
) => ({ actorId, slug, reaction, reactionId: randomUUID(), auditId: randomUUID() });
const ownRows = (actorId: string, id: string) =>
  db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.userId, actorId),
        eq(reactions.targetType, "content"),
        eq(reactions.targetId, id),
      ),
    );
it("serializes twenty concurrent retries, switches and remove/readd without duplicate votes/notices or changing publication revision", async () => {
  const author = await actor(),
    reader = await actor(),
    item = await publication(author.id);
  await Promise.all(
    Array.from({ length: 20 }, () => repository.set(command(reader.id, item.slug, "helpful"))),
  );
  expect(await ownRows(reader.id, item.id)).toHaveLength(1);
  expect(await repository.state(item.slug, reader.id)).toMatchObject({
    reaction: "helpful",
    counts: { helpful: 1, thanks: 0, insight: 0 },
  });
  await repository.set(command(reader.id, item.slug, "thanks"));
  await repository.set(command(reader.id, item.slug, null));
  await repository.set(command(reader.id, item.slug, "insight"));
  const [updated] = await db.select().from(content).where(eq(content.id, item.id));
  expect(updated.updatedAt.getTime()).toBe(item.updatedAt.getTime());
  expect(updated.likeCount).toBe(0);
  const notices = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, author.id),
        eq(notifications.title, "Publication reaction"),
      ),
    );
  expect(notices).toHaveLength(1);
});
it("normalizes legacy duplicates and excludes self votes while counting only each reader's latest reaction", async () => {
  const author = await actor(),
    reader = await actor(),
    item = await publication(author.id);
  await db.insert(reactions).values([
    {
      id: randomUUID(),
      userId: reader.id,
      targetType: "content",
      targetId: item.id,
      emoji: "👍",
      createdAt: new Date("2026-01-01"),
    },
    {
      id: randomUUID(),
      userId: reader.id,
      targetType: "content",
      targetId: item.id,
      emoji: "❤️",
      createdAt: new Date("2026-01-02"),
    },
    { id: randomUUID(), userId: author.id, targetType: "content", targetId: item.id, emoji: "👍" },
  ]);
  expect(await repository.state(item.slug, reader.id)).toMatchObject({
    reaction: "thanks",
    counts: { helpful: 0, thanks: 1, insight: 0 },
  });
  await repository.set(command(reader.id, item.slug, "helpful"));
  expect(await ownRows(reader.id, item.id)).toHaveLength(1);
  await expect(repository.set(command(author.id, item.slug, "thanks"))).rejects.toMatchObject({
    code: "REACTION_SELF",
  });
  await repository.set(command(author.id, item.slug, null));
  expect(await ownRows(author.id, item.id)).toHaveLength(0);
});
it("masks archived/missing target metadata and allows only own idempotent cleanup", async () => {
  const author = await actor(),
    reader = await actor(),
    other = await actor(),
    item = await publication(author.id);
  await repository.set(command(reader.id, item.slug, "helpful"));
  await db
    .update(content)
    .set({ status: "archived", title: "Private title" })
    .where(eq(content.id, item.id));
  const page = await repository.page(reader.id);
  expect(page.items[0]).toMatchObject({ title: null, slug: null, type: null });
  await expect(repository.set(command(reader.id, item.slug, "thanks"))).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await contentReactionService.remove(other, item.id);
  expect(await ownRows(reader.id, item.id)).toHaveLength(1);
  await db.delete(content).where(eq(content.id, item.id));
  await contentReactionService.remove(reader, item.id);
  await contentReactionService.remove(reader, item.id);
  expect(await ownRows(reader.id, item.id)).toHaveLength(0);
});
it("rolls back reaction/counter when audit fails and honors author's disabled content notifications", async () => {
  const author = await actor(),
    reader = await actor(),
    item = await publication(author.id);
  await db
    .insert(notificationPreferences)
    .values({ id: randomUUID(), userId: author.id, contentEnabled: false });
  const first = command(reader.id, item.slug, "helpful");
  await repository.set(first);
  await expect(
    repository.set({ ...command(reader.id, item.slug, "thanks"), auditId: first.auditId }),
  ).rejects.toThrow();
  expect(await repository.state(item.slug, reader.id)).toMatchObject({
    reaction: "helpful",
    counts: { helpful: 1, thanks: 0, insight: 0 },
  });
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, author.id)),
  ).toHaveLength(0);
});
it("traverses twenty-five equal-microsecond targets without duplicates and rejects foreign cursors", async () => {
  const author = await actor(),
    reader = await actor(),
    other = await actor();
  const items = await Promise.all(Array.from({ length: 25 }, () => publication(author.id)));
  await db.insert(reactions).values(
    items.map((item) => ({
      id: randomUUID(),
      userId: reader.id,
      targetType: "content",
      targetId: item.id,
      emoji: "👍",
      createdAt: sql`'2026-10-11T00:00:00.123456Z'::timestamptz`,
    })),
  );
  const first = await contentReactionService.page(reader, { query: "" });
  const query = parseReactionPage(new URLSearchParams({ cursor: first.nextCursor ?? "" }));
  if (!query) throw new Error("Invalid fixture");
  const second = await contentReactionService.page(reader, query);
  expect([...first.items, ...second.items].map((row) => row.contentId)).toEqual(
    items
      .map((item) => item.id)
      .sort()
      .reverse(),
  );
  expect(second.hasMore).toBe(false);
  expect(JSON.parse(first.nextCursor ?? "").createdAt).toBe("2026-10-11T00:00:00.123456Z");
  await expect(contentReactionService.page(other, query)).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
});
it("gates trust by live role/flags/ownership and excludes private activity, evidence and nonpublic servers", async () => {
  const author = await actor();
  await db
    .update(users)
    .set({ role: "developer", isVerified: true })
    .where(eq(users.id, author.id));
  await db
    .insert(developerProfiles)
    .values({ id: randomUUID(), userId: author.id, verifiedDeveloper: true });
  await db.insert(userProfilePreferences).values({ userId: author.id, showActivity: false });
  await publication(author.id);
  await db.insert(verificationRequests).values({
    id: randomUUID(),
    requesterId: author.id,
    targetType: "developer",
    targetId: author.id,
    status: "approved",
    proofUrl: "https://private.test/proof",
    reviewNotes: "private",
    resolvedAt: new Date(),
  });
  for (const visibility of ["public", "private"]) {
    const id = randomUUID();
    serverIds.push(id);
    await db.insert(servers).values({
      id,
      slug: `trust-${id}`,
      name: "Server",
      ipAddress: `${id}.test`,
      ownerId: author.id,
      visibility,
      isVerified: true,
    });
  }
  const orgId = randomUUID();
  organizationIds.push(orgId);
  await db.insert(organizations).values({
    id: orgId,
    slug: `trust-${orgId}`,
    name: "Team",
    ownerId: author.id,
    isVerified: true,
  });
  expect(await publicUserTrustRepository.find(author.username)).toMatchObject({
    developerVerified: true,
    servers: 1,
    verifiedServers: 1,
    organizations: 1,
    verifiedOrganizations: 1,
    publications: null,
  });
  await db.update(users).set({ role: "user", isVerified: false }).where(eq(users.id, author.id));
  const row = await publicUserTrustRepository.find(author.username);
  expect(row).toMatchObject({
    identityVerified: false,
    identityApprovalAt: null,
    developerVerified: false,
    developerApprovalAt: null,
  });
  expect(JSON.stringify(row)).not.toContain("private.test");
  expect(row).not.toHaveProperty("reviewNotes");
});

it("public helpful counts ignore a legacy cache and an account's deleted reactions", async () => {
  const author = await actor(),
    reader = await actor(),
    item = await publication(author.id, { likeCount: 99 });
  expect(
    await contentRepository.findPublishedBySlug(item.slug, { incrementView: false }),
  ).toHaveProperty("likeCount", 0);
  await repository.set(command(reader.id, item.slug, "helpful"));
  expect(
    await contentRepository.findPublishedBySlug(item.slug, { incrementView: false }),
  ).toHaveProperty("likeCount", 1);
  await db.delete(users).where(eq(users.id, reader.id));
  expect(
    await contentRepository.findPublishedBySlug(item.slug, { incrementView: false }),
  ).toHaveProperty("likeCount", 0);
});
