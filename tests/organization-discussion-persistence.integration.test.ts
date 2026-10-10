import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  organizationWorkspaceRepository as teams,
  contentRepository,
  contentDiscussionRepository,
  userRepository,
} from "@nexus/db";
import {
  auditEvents,
  organizations,
  organizationMembers,
  users,
  comments,
  content,
} from "../packages/db/src/schema";
import type { User } from "@nexus/domain";
const actorIds: string[] = [],
  orgIds: string[] = [];
afterEach(async () => {
  if (actorIds.length) await db.delete(auditEvents).where(inArray(auditEvents.actorId, actorIds));
  if (orgIds.length) await db.delete(organizations).where(inArray(organizations.id, orgIds));
  if (actorIds.length) await db.delete(users).where(inArray(users.id, actorIds));
  actorIds.length = 0;
  orgIds.length = 0;
});
async function actor() {
  const suffix = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_team_${suffix}`,
    username: `team_${suffix}`,
    email: `team_${suffix}@nexus.test`,
    displayName: "Team member",
  });
  actorIds.push(user.id);
  return user;
}
function audit(user: User, id: string, action = "organization.member_updated") {
  return {
    id: `aud_team_${randomUUID()}`,
    actorId: user.id,
    actorType: "user" as const,
    action,
    targetId: id,
    targetType: "organization",
  };
}
async function organization(owner: User) {
  const id = `org_team_${randomUUID()}`;
  orgIds.push(id);
  return teams.create(
    id,
    owner.id,
    `team-${randomUUID()}`,
    { name: "Test organization", description: "", logoUrl: "", websiteUrl: "" },
    audit(owner, id, "organization.created"),
  );
}
it("commits one concurrent team operation and advances the same profile revision", async () => {
  const owner = await actor(),
    a = await actor(),
    b = await actor(),
    org = await organization(owner);
  const results = await Promise.allSettled(
    [a, b].map((user) =>
      teams.addMember(
        org.id,
        owner.id,
        org.updatedAt,
        user.username,
        "member",
        false,
        `mem_${randomUUID()}`,
        audit(owner, org.id, "organization.member_added"),
      ),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "CONFLICT" },
  });
  const stored = await teams.getWorkspace(org.id, owner.id);
  expect(stored.members).toHaveLength(1);
  expect(stored.organization.updatedAt.getTime()).toBeGreaterThan(org.updatedAt.getTime());
  const rows = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(
      and(eq(auditEvents.targetId, org.id), eq(auditEvents.action, "organization.member_added")),
    );
  expect(rows).toHaveLength(1);
});
it("preserves unrelated commercial grants and prevents an administrator takeover", async () => {
  const owner = await actor(),
    admin = await actor(),
    member = await actor(),
    org = await organization(owner);
  const addedAdmin = await teams.addMember(
    org.id,
    owner.id,
    org.updatedAt,
    admin.username,
    "admin",
    false,
    `mem_${randomUUID()}`,
    audit(owner, org.id),
  );
  const added = await teams.addMember(
    org.id,
    owner.id,
    addedAdmin.organization.updatedAt,
    member.username,
    "developer",
    true,
    `mem_${randomUUID()}`,
    audit(owner, org.id),
  );
  await db
    .update(organizationMembers)
    .set({ permissions: ["manage_products", "custom", "manage_servers"] })
    .where(
      and(
        eq(organizationMembers.organizationId, org.id),
        eq(organizationMembers.userId, member.id),
      ),
    );
  await expect(
    teams.changeMember(
      org.id,
      admin.id,
      added.organization.updatedAt,
      owner.id,
      null,
      audit(admin, org.id),
    ),
  ).rejects.toMatchObject({ code: "MEMBER_PROTECTED" });
  const changed = await teams.changeMember(
    org.id,
    admin.id,
    added.organization.updatedAt,
    member.id,
    { role: "member", managesServers: false },
    audit(admin, org.id),
  );
  const [stored] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, org.id),
        eq(organizationMembers.userId, member.id),
      ),
    );
  expect(stored.permissions).toEqual(["manage_products", "custom"]);
  expect(stored.role).toBe("member");
  await teams.leave(
    org.id,
    member.id,
    changed.organization.updatedAt,
    audit(member, org.id, "organization.member_left"),
  );
  await expect(teams.getWorkspace(org.id, member.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("rolls back a membership mutation and revision when audit persistence fails", async () => {
  const owner = await actor(),
    member = await actor(),
    org = await organization(owner);
  const [existingAudit] = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(eq(auditEvents.targetId, org.id));
  await expect(
    teams.addMember(
      org.id,
      owner.id,
      org.updatedAt,
      member.username,
      "member",
      false,
      `mem_${randomUUID()}`,
      { ...audit(owner, org.id), id: existingAudit.id },
    ),
  ).rejects.toBeDefined();
  const stored = await teams.getWorkspace(org.id, owner.id);
  expect(stored.members).toHaveLength(0);
  expect(stored.organization.updatedAt.getTime()).toBe(org.updatedAt.getTime());
});
async function article(author: User) {
  return contentRepository.create({
    id: `cnt_thread_${randomUUID()}`,
    slug: `thread-${randomUUID()}`,
    title: "Discussion",
    body: "A complete discussion body",
    type: "post",
    status: "published",
    authorId: author.id,
    tags: [],
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
  });
}
it("traverses every same-timestamp comment without duplicates using microsecond keysets", async () => {
  const user = await actor(),
    articleRow = await article(user);
  const values = Array.from({ length: 45 }, (_, index) => ({
    id: `cmt_thread_${String(index).padStart(3, "0")}_${randomUUID()}`,
    contentId: articleRow.id,
    authorId: user.id,
    text: `Comment ${index}`,
    createdAt: sql`'2026-10-10T12:00:00.000123Z'::timestamptz`,
  }));
  await db.insert(comments).values(values);
  const ids: string[] = [];
  let cursor: undefined | { createdAt: string; id: string };
  do {
    const page = await contentDiscussionRepository.page(articleRow.id, cursor);
    ids.push(...page.items.map((row) => row.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(ids).toHaveLength(45);
  expect(new Set(ids).size).toBe(45);
});
it("rejects archived targets and cross-article parents without changing counts or audit", async () => {
  const user = await actor(),
    one = await article(user),
    two = await article(user);
  const parent = await contentRepository.addComment({
    id: `cmt_thread_${randomUUID()}`,
    contentId: one.id,
    authorId: user.id,
    text: "Parent comment",
    isVerifiedPurchase: false,
  });
  await expect(
    contentRepository.addComment({
      id: `cmt_thread_${randomUUID()}`,
      contentId: two.id,
      parentId: parent.id,
      authorId: user.id,
      text: "Reply",
      isVerifiedPurchase: false,
    }),
  ).rejects.toMatchObject({ code: "COMMENT_PARENT_NOT_FOUND" });
  await db.update(content).set({ status: "archived" }).where(eq(content.id, one.id));
  await expect(
    contentRepository.addComment({
      id: `cmt_thread_${randomUUID()}`,
      contentId: one.id,
      authorId: user.id,
      text: "Late comment",
      isVerifiedPurchase: false,
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  const [stored] = await db.select().from(content).where(eq(content.id, one.id));
  expect(stored.commentCount).toBe(1);
  expect(stored.updatedAt.getTime()).toBe(one.updatedAt.getTime());
  expect((await contentDiscussionRepository.page(one.id)).items).toHaveLength(0);
});
