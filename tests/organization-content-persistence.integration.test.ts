import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import {
  db,
  authorContentRepository as author,
  organizationContentRepository as team,
  userRepository,
  auditEvents,
  comments,
  content,
  organizationMembers,
  organizations,
  users,
} from "@nexus/db";
const actors: string[] = [],
  orgs: string[] = [];
afterEach(async () => {
  if (actors.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    await db.delete(content).where(inArray(content.authorId, actors));
  }
  if (orgs.length) await db.delete(organizations).where(inArray(organizations.id, orgs));
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  orgs.length = 0;
});
async function actor(role = "user") {
  const suffix = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_editor_${suffix}`,
    username: `editor_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Editor",
    role,
  });
  actors.push(user.id);
  return user;
}
async function fixture() {
  const owner = await actor(),
    admin = await actor(),
    writer = await actor("developer"),
    outsider = await actor("admin");
  const orgId = `org_editor_${randomUUID()}`;
  orgs.push(orgId);
  await db
    .insert(organizations)
    .values({
      id: orgId,
      name: "Editorial team",
      slug: `editor-${randomUUID()}`,
      ownerId: owner.id,
    });
  await db.insert(organizationMembers).values([
    { id: `mem_${randomUUID()}`, organizationId: orgId, userId: admin.id, role: "admin" },
    { id: `mem_${randomUUID()}`, organizationId: orgId, userId: writer.id, role: "developer" },
  ]);
  const [item] = await db
    .insert(content)
    .values({
      id: `cnt_editor_${randomUUID()}`,
      authorId: writer.id,
      organizationId: orgId,
      slug: `editor-${randomUUID()}`,
      title: "Original",
      body: "Original publication body",
      type: "article",
      status: "published",
      publishedAt: new Date(),
      commentCount: 1,
    })
    .returning();
  await db
    .insert(comments)
    .values({
      id: `cmt_${randomUUID()}`,
      authorId: writer.id,
      contentId: item.id,
      text: "Existing discussion",
    });
  return { owner, admin, writer, outsider, orgId, item };
}
const fields = {
  title: "Team edit",
  body: "Updated publication body",
  tags: ["Lua"],
  excerpt: "",
  coverImageUrl: "",
};
const audit = (actorId: string, targetId: string, id = `aud_${randomUUID()}`) => ({
  id,
  actorId,
  actorType: "user" as const,
  action: "content.edited_by_organization",
  targetId,
  targetType: "content",
});
it("lets the owner and current administrator edit another author's material without changing attribution, URL or discussion", async () => {
  const f = await fixture();
  const first = await author.mutate(
    f.item.id,
    f.owner.id,
    f.item.updatedAt,
    "published",
    fields,
    audit(f.owner.id, f.item.id),
    f.orgId,
  );
  const second = await author.mutate(
    f.item.id,
    f.admin.id,
    new Date(first.updatedAt),
    "draft",
    fields,
    audit(f.admin.id, f.item.id),
    f.orgId,
  );
  expect(second).toMatchObject({
    authorId: f.writer.id,
    organizationId: f.orgId,
    slug: f.item.slug,
    status: "draft",
    commentCount: 1,
  });
  expect(new Date(second.updatedAt).getTime()).toBeGreaterThan(new Date(first.updatedAt).getTime());
  expect(await db.select().from(comments).where(eq(comments.contentId, f.item.id))).toHaveLength(1);
  expect((await team.page(f.orgId, f.admin.id)).items.map((row) => row.id)).toContain(f.item.id);
});
it("denies stale ownership, revoked membership, developers editing team content and platform administrators without team rights", async () => {
  const f = await fixture();
  await db
    .update(organizationMembers)
    .set({ role: "owner" })
    .where(
      and(
        eq(organizationMembers.organizationId, f.orgId),
        eq(organizationMembers.userId, f.admin.id),
      ),
    );
  for (const user of [f.admin, f.writer, f.outsider]) {
    await expect(team.page(f.orgId, user.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      author.mutate(
        f.item.id,
        user.id,
        f.item.updatedAt,
        "published",
        fields,
        audit(user.id, f.item.id),
        f.orgId,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  }
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, f.orgId),
        eq(organizationMembers.userId, f.admin.id),
      ),
    );
  await expect(
    author.mutate(
      f.item.id,
      f.admin.id,
      f.item.updatedAt,
      "published",
      fields,
      audit(f.admin.id, f.item.id),
      f.orgId,
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.item.id))).toEqual(
    [],
  );
});
it("allows one concurrent organization or original-author edit of the same observed version", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([
    author.mutate(
      f.item.id,
      f.admin.id,
      f.item.updatedAt,
      "published",
      fields,
      audit(f.admin.id, f.item.id),
      f.orgId,
    ),
    author.mutate(
      f.item.id,
      f.writer.id,
      f.item.updatedAt,
      "published",
      { ...fields, title: "Author edit" },
      audit(f.writer.id, f.item.id),
    ),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "CONFLICT" },
  });
  expect(
    await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.item.id)),
  ).toHaveLength(1);
});
it("rolls back an edit on audit failure and preserves archived materials as read-only", async () => {
  const f = await fixture(),
    collision = audit(f.admin.id, f.item.id);
  await db.insert(auditEvents).values(collision);
  await expect(
    author.mutate(f.item.id, f.admin.id, f.item.updatedAt, "published", fields, collision, f.orgId),
  ).rejects.toThrow();
  expect((await team.get(f.orgId, f.owner.id, f.item.id)).content).toMatchObject({
    title: "Original",
    status: "published",
    updatedAt: f.item.updatedAt,
  });
  const archived = await author.mutate(
    f.item.id,
    f.admin.id,
    f.item.updatedAt,
    "published",
    null,
    audit(f.admin.id, f.item.id),
    f.orgId,
  );
  await expect(
    author.mutate(
      f.item.id,
      f.owner.id,
      new Date(archived.updatedAt),
      "archived",
      fields,
      audit(f.owner.id, f.item.id),
      f.orgId,
    ),
  ).rejects.toMatchObject({ code: "CONTENT_ARCHIVED" });
  expect(await db.select().from(comments).where(eq(comments.contentId, f.item.id))).toHaveLength(1);
});
