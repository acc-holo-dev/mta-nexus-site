import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, authorContentRepository, contentRepository, userRepository } from "@nexus/db";
import {
  auditEvents,
  comments,
  organizations,
  organizationMembers,
  users,
} from "../packages/db/src/schema";
import type { Content, User } from "@nexus/domain";
const createdUsers: string[] = [],
  createdOrganizations: string[] = [];
afterEach(async () => {
  if (createdUsers.length)
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, createdUsers));
  if (createdOrganizations.length)
    await db.delete(organizations).where(inArray(organizations.id, createdOrganizations));
  if (createdUsers.length) await db.delete(users).where(inArray(users.id, createdUsers));
  createdUsers.length = 0;
  createdOrganizations.length = 0;
});
async function user() {
  const suffix = randomUUID().replaceAll("-", "");
  const actor = await userRepository.create({
    id: `usr_platform_${suffix}`,
    username: `platform_${suffix}`,
    email: `platform_${suffix}@nexus.test`,
    displayName: "Platform author",
  });
  createdUsers.push(actor.id);
  return actor;
}
async function publication(actor: User, type: Content["type"] = "post", organizationId?: string) {
  const id = `cnt_platform_${randomUUID()}`;
  return contentRepository.create({
    id,
    slug: `platform-${randomUUID()}`,
    title: "Platform publication",
    body: "A complete original publication.",
    type,
    status: "published",
    tags: [],
    authorId: actor.id,
    organizationId,
    viewCount: 5,
    likeCount: 2,
    commentCount: 0,
    publishedAt: new Date(),
  });
}
const audit = (actor: User, item: Content) => ({
  id: `aud_platform_${randomUUID()}`,
  actorId: actor.id,
  actorType: "user" as const,
  action: "content.edited_by_author",
  targetId: item.id,
  targetType: "content",
});
const edit = (title: string) => ({
  title,
  body: "A complete edited publication.",
  excerpt: "",
  coverImageUrl: "",
  tags: ["mta"],
});
it("serializes concurrent writer edits and preserves discussion counters and audit consistency", async () => {
  const actor = await user(),
    item = await publication(actor);
  await contentRepository.addComment({
    id: `cmt_platform_${randomUUID()}`,
    contentId: item.id,
    authorId: actor.id,
    text: "Existing reply",
    isVerifiedPurchase: false,
  });
  const current = await authorContentRepository.findAuthored(item.id, actor.id);
  expect(current).not.toBeNull();
  if (!current) return;
  const results = await Promise.allSettled(
    ["First title", "Second title"].map((title) =>
      authorContentRepository.mutate(
        item.id,
        actor.id,
        current.updatedAt,
        current.status,
        edit(title),
        audit(actor, item),
      ),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "CONFLICT" },
  });
  const stored = await authorContentRepository.findAuthored(item.id, actor.id);
  expect(stored).toMatchObject({
    commentCount: 1,
    viewCount: 5,
    likeCount: 2,
    status: "published",
  });
  expect(stored?.updatedAt.getTime() ?? 0).toBeGreaterThan(current.updatedAt.getTime());
  const audits = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(eq(auditEvents.targetId, item.id));
  expect(audits).toHaveLength(1);
});
it("returns editorial edits to moderation and archives without deleting existing replies", async () => {
  const actor = await user(),
    item = await publication(actor, "article");
  await contentRepository.addComment({
    id: `cmt_platform_${randomUUID()}`,
    contentId: item.id,
    authorId: actor.id,
    text: "Preserved discussion",
    isVerifiedPurchase: false,
  });
  const current = await authorContentRepository.findAuthored(item.id, actor.id);
  expect(current).not.toBeNull();
  if (!current) return;
  const updated = await authorContentRepository.mutate(
    item.id,
    actor.id,
    current.updatedAt,
    current.status,
    edit("Edited article"),
    audit(actor, item),
  );
  expect(updated.status).toBe("draft");
  expect(
    await contentRepository.findPublishedBySlug(item.slug, { incrementView: false }),
  ).toBeNull();
  const archived = await authorContentRepository.mutate(
    item.id,
    actor.id,
    updated.updatedAt,
    updated.status,
    null,
    audit(actor, item),
  );
  expect(archived.status).toBe("archived");
  await expect(
    authorContentRepository.mutate(
      item.id,
      actor.id,
      archived.updatedAt,
      archived.status,
      edit("Reopened"),
      audit(actor, item),
    ),
  ).rejects.toMatchObject({ code: "CONTENT_ARCHIVED" });
  expect(
    await db.select({ id: comments.id }).from(comments).where(eq(comments.contentId, item.id)),
  ).toHaveLength(1);
});
it("rejects revoked organization permissions before altering content or inserting an audit", async () => {
  const owner = await user(),
    actor = await user();
  const organizationId = `org_platform_${randomUUID()}`;
  await db.insert(organizations).values({
    id: organizationId,
    ownerId: owner.id,
    name: "Platform organization",
    slug: `platform-${randomUUID()}`,
  });
  createdOrganizations.push(organizationId);
  await db.insert(organizationMembers).values({
    id: `orgm_platform_${randomUUID()}`,
    organizationId,
    userId: actor.id,
    role: "developer",
  });
  const item = await publication(actor, "article", organizationId);
  await db
    .update(organizationMembers)
    .set({ role: "member" })
    .where(eq(organizationMembers.userId, actor.id));
  await expect(
    authorContentRepository.mutate(
      item.id,
      actor.id,
      item.updatedAt,
      item.status,
      edit("Unauthorized edit"),
      audit(actor, item),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await authorContentRepository.findAuthored(item.id, actor.id)).toMatchObject({
    title: item.title,
    status: item.status,
  });
  expect(
    await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(eq(auditEvents.targetId, item.id)),
  ).toHaveLength(0);
});
it("permits one concurrent profile version and persists its public fields and audit", async () => {
  const actor = await user();
  const results = await Promise.all(
    ["First name", "Second name"].map((displayName) =>
      userRepository.updatePublicProfile(
        actor.id,
        actor.updatedAt,
        { displayName, bio: "Updated biography", avatarUrl: "" },
        `aud_platform_${randomUUID()}`,
      ),
    ),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  const confirmed = results.find(Boolean);
  expect(await userRepository.findByUsername(actor.username)).toMatchObject({
    displayName: confirmed?.displayName,
    bio: "Updated biography",
    role: actor.role,
    isVerified: false,
  });
  const audits = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(eq(auditEvents.targetId, actor.id));
  expect(audits).toHaveLength(1);
});
