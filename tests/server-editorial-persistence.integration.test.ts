import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import {
  db,
  sessionRepository,
  userRepository,
  serverContentRepository as editorial,
  authorContentRepository as author,
  contentRepository,
  auditEvents,
  content,
  notifications,
  notificationPreferences,
  organizationMembers,
  organizations,
  servers,
  users,
} from "@nexus/db";
const actors: string[] = [],
  serverIds: string[] = [],
  orgs: string[] = [];
afterEach(async () => {
  if (actors.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    await db.delete(content).where(inArray(content.authorId, actors));
  }
  if (serverIds.length) await db.delete(servers).where(inArray(servers.id, serverIds));
  if (orgs.length) await db.delete(organizations).where(inArray(organizations.id, orgs));
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  serverIds.length = 0;
  orgs.length = 0;
});
async function actor(role = "user") {
  const suffix = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_serveredit_${suffix}`,
    username: `serveredit_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Editor",
    role,
  });
  actors.push(user.id);
  return user;
}
async function fixture() {
  const owner = await actor(),
    writer = await actor("developer"),
    manager = await actor(),
    moderator = await actor("moderator"),
    orgId = `org_${randomUUID()}`,
    serverId = `srv_${randomUUID()}`;
  await sessionRepository.create({
    id: `ses_${moderator.id}`,
    userId: moderator.id,
    token: `tok_${moderator.id}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  orgs.push(orgId);
  serverIds.push(serverId);
  await db
    .insert(organizations)
    .values({ id: orgId, name: "Team", slug: `team-${randomUUID()}`, ownerId: owner.id });
  await db.insert(organizationMembers).values(
    [writer, manager].map((user) => ({
      id: `mem_${randomUUID()}`,
      organizationId: orgId,
      userId: user.id,
      role: "member",
      permissions: ["manage_servers"],
    })),
  );
  await db.insert(servers).values({
    id: serverId,
    name: "Private test server",
    slug: `server-${randomUUID()}`,
    ipAddress: `${randomUUID()}.test`,
    port: 22003,
    visibility: "private",
    organizationId: orgId,
  });
  const [item] = await db
    .insert(content)
    .values({
      id: `cnt_${randomUUID()}`,
      authorId: writer.id,
      serverId,
      organizationId: orgId,
      title: "Draft title",
      slug: `draft-${randomUUID()}`,
      body: "Original private body",
      type: "news",
      status: "draft",
    })
    .returning();
  return { owner, writer, manager, moderator, orgId, serverId, item };
}
const fields = {
  title: "Updated",
  body: "Updated private publication",
  tags: ["Lua"],
  excerpt: "",
  coverImageUrl: "",
};
const audit = (
  actorId: string,
  id: string,
  action = "content.edited_by_server",
  auditId = `aud_${randomUUID()}`,
) => ({
  id: auditId,
  actorId,
  actorType: "user" as const,
  targetId: id,
  targetType: "content",
  action,
});
it("persists delegated server drafts, current organization context and an owner's notice without exposing private network or body fields", async () => {
  const f = await fixture(),
    id = `cnt_${randomUUID()}`;
  const saved = await editorial.create(
    f.serverId,
    f.manager.id,
    {
      ...fields,
      id,
      authorId: "injected",
      organizationId: "foreign",
      slug: `new-${randomUUID()}`,
      type: "news",
      status: "published",
      viewCount: 5,
      likeCount: 2,
      commentCount: 3,
    },
    audit(f.manager.id, id, "content.created_by_server"),
  );
  expect(saved).toMatchObject({
    serverId: f.serverId,
    organizationId: f.orgId,
    authorId: f.manager.id,
    status: "draft",
    publishedAt: null,
    commentCount: 0,
  });
  const result = await editorial.page(f.serverId, f.owner.id);
  expect(result.items.map((row) => row.id)).toContain(f.item.id);
  expect(result.items.map((row) => row.id)).toContain(id);
  expect(result.server).not.toHaveProperty("ipAddress");
  const notice = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, f.owner.id));
  expect(notice).toHaveLength(1);
  expect(notice[0].link).toBe(`/workspace/servers/${f.serverId}/content/${id}`);
  expect(JSON.stringify(notice)).not.toContain(fields.body);
});
it("allows one current-version team or original-author edit and honors content-notification opt-out", async () => {
  const f = await fixture();
  await db
    .insert(notificationPreferences)
    .values({ id: `npr_${randomUUID()}`, userId: f.writer.id, contentEnabled: false });
  const outcomes = await Promise.allSettled([
    author.mutate(
      f.item.id,
      f.manager.id,
      f.item.updatedAt,
      "draft",
      fields,
      audit(f.manager.id, f.item.id),
      undefined,
      f.serverId,
    ),
    author.mutate(
      f.item.id,
      f.writer.id,
      f.item.updatedAt,
      "draft",
      { ...fields, title: "Writer edit" },
      audit(f.writer.id, f.item.id),
    ),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "CONFLICT" },
  });
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, f.writer.id)),
  ).toHaveLength(0);
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, f.owner.id)),
  ).toHaveLength(1);
  expect((await editorial.get(f.serverId, f.owner.id, f.item.id)).content.authorId).toBe(
    f.writer.id,
  );
});
it("revokes server scope for reads, direct writes and legacy author edits without accepting stale ownership or platform moderator privilege", async () => {
  const f = await fixture();
  await db
    .update(organizationMembers)
    .set({ role: "owner", permissions: ["manage_servers"] })
    .where(
      and(
        eq(organizationMembers.organizationId, f.orgId),
        eq(organizationMembers.userId, f.writer.id),
      ),
    );
  await expect(editorial.page(f.serverId, f.writer.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(
    author.mutate(
      f.item.id,
      f.writer.id,
      f.item.updatedAt,
      "draft",
      fields,
      audit(f.writer.id, f.item.id),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(editorial.page(f.serverId, f.moderator.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(
    await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.item.id)),
  ).toHaveLength(0);
});
it("never publishes an unreviewed parallel draft and rechecks the moderator's live role", async () => {
  const f = await fixture();
  const outcomes = await Promise.allSettled([
    contentRepository.moderateStatusWithAudit(
      f.item.id,
      "published",
      "draft",
      audit(f.moderator.id, f.item.id, "content.published"),
      `tok_${f.moderator.id}`,
      f.item.updatedAt,
    ),
    author.mutate(
      f.item.id,
      f.manager.id,
      f.item.updatedAt,
      "draft",
      fields,
      audit(f.manager.id, f.item.id),
      undefined,
      f.serverId,
    ),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled" && r.value !== null)).toHaveLength(1);
  expect(
    await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.item.id)),
  ).toHaveLength(1);
  const [stored] = await db.select().from(content).where(eq(content.id, f.item.id));
  if (stored.status === "published") expect(stored.body).toBe("Original private body");
  if (stored.status !== "published" && stored.status !== "draft")
    throw new Error("Unexpected fixture status");
  await db.update(users).set({ role: "user" }).where(eq(users.id, f.moderator.id));
  await expect(
    contentRepository.moderateStatusWithAudit(
      f.item.id,
      "archived",
      stored.status,
      audit(f.moderator.id, f.item.id, "content.archived"),
      `tok_${f.moderator.id}`,
      stored.updatedAt,
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("rolls back the publication and audit when an inbox insert fails", async () => {
  const f = await fixture(),
    command = audit(f.manager.id, f.item.id),
    id = `ntf_publication_${createHash("sha256")
      .update(JSON.stringify([command.id, f.owner.id]))
      .digest("hex")}`;
  await db
    .insert(notifications)
    .values({ id, recipientId: f.owner.id, title: "Collision fixture", message: "Fixture" });
  await expect(
    author.mutate(
      f.item.id,
      f.manager.id,
      f.item.updatedAt,
      "draft",
      fields,
      command,
      undefined,
      f.serverId,
    ),
  ).rejects.toThrow();
  expect((await editorial.get(f.serverId, f.owner.id, f.item.id)).content).toMatchObject({
    title: "Draft title",
    updatedAt: f.item.updatedAt,
  });
  expect(await db.select().from(auditEvents).where(eq(auditEvents.id, command.id))).toHaveLength(0);
});
