import { randomUUID } from "node:crypto";
import {
  auditEvents,
  comments,
  content,
  db,
  discussionManagementRepository as discussions,
  communityModerationWorkspaceRepository as moderation,
  notifications,
  organizationMembers,
  organizations,
  organizationWorkspaceRepository as teams,
  userRepository,
  users,
} from "@nexus/db";
import type { User } from "@nexus/domain";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";

const actorIds: string[] = [],
  orgIds: string[] = [];
afterEach(async () => {
  if (actorIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actorIds));
    await db.delete(content).where(inArray(content.authorId, actorIds));
  }
  if (orgIds.length) await db.delete(organizations).where(inArray(organizations.id, orgIds));
  if (actorIds.length) await db.delete(users).where(inArray(users.id, actorIds));
  actorIds.length = 0;
  orgIds.length = 0;
});
async function actor(role = "user") {
  const key = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_batch_${key}`,
    username: `batch_${key}`,
    email: `${key}@nexus.test`,
    displayName: "Team writer",
    role,
  });
  actorIds.push(user.id);
  return user;
}
function audit(user: User, id: string, eventId = `aud_${randomUUID()}`) {
  return {
    id: eventId,
    actorId: user.id,
    actorType: "user" as const,
    targetType: "organization",
    targetId: id,
    action: "organization.member_updated",
  };
}
async function team() {
  const owner = await actor(),
    a = await actor(),
    b = await actor();
  const id = `org_${randomUUID()}`;
  orgIds.push(id);
  const organization = await teams.create(
    id,
    owner.id,
    `team-${randomUUID()}`,
    { name: "Batch team", description: "", logoUrl: "", websiteUrl: "" },
    audit(owner, id),
  );
  await db.insert(organizationMembers).values(
    [a, b].map((user) => ({
      id: `mem_${randomUUID()}`,
      organizationId: id,
      userId: user.id,
      role: "member",
      permissions: ["manage_resources", "custom_commercial", "manage_servers"],
    })),
  );
  const input = {
    userIds: [a.id, b.id],
    change: { action: "server_access", enabled: false } as const,
    expectedUpdatedAt: organization.updatedAt,
  };
  return { owner, a, b, organization, input };
}
it("commits a reviewed group together and retains unrelated grants with one notice/event per changed member", async () => {
  const { owner, a, b, organization, input } = await team(),
    preview = await teams.previewMembers(organization.id, owner.id, input);
  const saved = await teams.batchMembers(
    organization.id,
    owner.id,
    { ...input, previewRevision: preview.previewRevision },
    [a, b].map(() => audit(owner, organization.id)),
  );
  expect(saved.changedUserIds.sort()).toEqual([a.id, b.id].sort());
  expect(saved.organization.updatedAt.getTime()).toBeGreaterThan(organization.updatedAt.getTime());
  const rows = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organization.id),
        inArray(organizationMembers.userId, [a.id, b.id]),
      ),
    );
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.role).toBe("member");
    expect(row.permissions).toEqual(["manage_resources", "custom_commercial"]);
  }
  const notices = await db
    .select({ recipientId: notifications.recipientId })
    .from(notifications)
    .where(inArray(notifications.recipientId, [a.id, b.id]));
  expect(notices.map((row) => row.recipientId).sort()).toEqual([a.id, b.id].sort());
});
it("rejects an entire batch after current grants change and rolls back all rows when mandatory audit fails", async () => {
  const { owner, a, b, organization, input } = await team(),
    preview = await teams.previewMembers(organization.id, owner.id, input);
  await db
    .update(organizationMembers)
    .set({ permissions: ["changed_custom"] })
    .where(
      and(
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.userId, a.id),
      ),
    );
  await expect(
    teams.batchMembers(
      organization.id,
      owner.id,
      { ...input, previewRevision: preview.previewRevision },
      [a, b].map(() => audit(owner, organization.id)),
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  const refreshed = await teams.previewMembers(organization.id, owner.id, input),
    duplicate = audit(owner, organization.id);
  await db.insert(auditEvents).values(duplicate);
  await expect(
    teams.batchMembers(
      organization.id,
      owner.id,
      { ...input, previewRevision: refreshed.previewRevision },
      [audit(owner, organization.id), duplicate],
    ),
  ).rejects.toThrow();
  const stored = await teams.getWorkspace(organization.id, owner.id);
  expect(stored.organization.updatedAt.getTime()).toBe(organization.updatedAt.getTime());
  expect(stored.members.find((member) => member.id === b.id)?.managesServers).toBe(true);
  expect(
    await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(inArray(notifications.recipientId, [a.id, b.id])),
  ).toEqual([]);
});
it("serializes concurrent confirmations and commits exactly one batch", async () => {
  const { owner, a, b, organization, input } = await team(),
    preview = await teams.previewMembers(organization.id, owner.id, input);
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      teams.batchMembers(
        organization.id,
        owner.id,
        { ...input, previewRevision: preview.previewRevision },
        [a, b].map(() => audit(owner, organization.id)),
      ),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "CONFLICT" },
  });
});
async function thread(status = "archived") {
  const author = await actor(),
    staff = await actor("moderator");
  const [publication] = await db
    .insert(content)
    .values({
      id: `cnt_${randomUUID()}`,
      slug: `post-${randomUUID()}`,
      authorId: author.id,
      type: "post",
      status,
      title: "Private publication",
      body: "Private body",
      commentCount: 2,
    })
    .returning();
  const [message] = await db
    .insert(comments)
    .values({
      id: `cmt_${randomUUID()}`,
      authorId: author.id,
      contentId: publication.id,
      text: '🙂 Привет "quoted"\n'.repeat(1000),
    })
    .returning();
  const [reply] = await db
    .insert(comments)
    .values({
      id: `cmt_${randomUUID()}`,
      authorId: author.id,
      contentId: publication.id,
      parentId: message.id,
      text: "Reply survives",
    })
    .returning();
  return { author, staff, publication, message, reply };
}
it("binds a Unicode legacy comment's full text digest, removes archived discussion and retains replies, history and safe notice", async () => {
  const { author, staff, publication, message, reply } = await thread(),
    review = await moderation.discussionDetail(staff.id, publication.id, message.id);
  expect(review.comment?.truncated).toBe(true);
  expect(Array.from(review.comment?.text ?? "")).toHaveLength(5000);
  await discussions.mutate({
    moderationWorkspace: true,
    contentId: publication.id,
    commentId: message.id,
    actorId: staff.id,
    expectedRevision: reviewedRevision(review),
    reason: "Recorded moderation reason",
    auditId: `aud_${randomUUID()}`,
  });
  expect(await db.select().from(comments).where(eq(comments.id, message.id))).toEqual([]);
  expect(await db.select().from(comments).where(eq(comments.id, reply.id))).toHaveLength(1);
  const [stored] = await db
    .select({ count: content.commentCount })
    .from(content)
    .where(eq(content.id, publication.id));
  expect(stored.count).toBe(1);
  const retained = await moderation.discussionDetail(staff.id, publication.id, message.id);
  expect(retained.comment).toBeNull();
  expect(retained.history[0]).toMatchObject({
    action: "content.comment_removed",
    moderator: true,
    reason: "Recorded moderation reason",
  });
  const [notice] = await db
    .select({ link: notifications.link, message: notifications.message })
    .from(notifications)
    .where(eq(notifications.recipientId, author.id));
  expect(notice.link).toBe("/workspace/discussions");
  expect(notice.message).not.toContain("Recorded moderation reason");
});
it("rejects changed text, revoked staff and wrong publication without mutation or moderation notices", async () => {
  const { author, staff, publication, message } = await thread(),
    review = await moderation.discussionDetail(staff.id, publication.id, message.id);
  const input = {
    moderationWorkspace: true,
    contentId: publication.id,
    commentId: message.id,
    actorId: staff.id,
    expectedRevision: reviewedRevision(review),
    reason: "Reviewed reason",
    auditId: `aud_${randomUUID()}`,
  };
  await db.update(comments).set({ text: "Changed text" }).where(eq(comments.id, message.id));
  await expect(discussions.mutate(input)).rejects.toMatchObject({ code: "COMMENT_CHANGED" });
  await db.update(users).set({ role: "user" }).where(eq(users.id, staff.id));
  await expect(discussions.mutate(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    moderation.discussion(staff.id, publication.id, { query: "" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(
    await db.select({ id: comments.id }).from(comments).where(eq(comments.id, message.id)),
  ).toHaveLength(1);
  expect(
    await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.recipientId, author.id)),
  ).toEqual([]);
});
it("rejects a missing mandatory removal audit transactionally", async () => {
  const { author, staff, publication, message } = await thread(),
    review = await moderation.discussionDetail(staff.id, publication.id, message.id),
    eventId = `aud_${randomUUID()}`;
  await db.insert(auditEvents).values({
    id: eventId,
    actorId: staff.id,
    actorType: "admin",
    targetType: "comment",
    targetId: message.id,
    action: "unrelated",
  });
  await expect(
    discussions.mutate({
      moderationWorkspace: true,
      contentId: publication.id,
      commentId: message.id,
      actorId: staff.id,
      expectedRevision: reviewedRevision(review),
      reason: "Reason",
      auditId: eventId,
    }),
  ).rejects.toThrow();
  expect(await db.select().from(comments).where(eq(comments.id, message.id))).toHaveLength(1);
  const [stored] = await db
    .select({ count: content.commentCount })
    .from(content)
    .where(eq(content.id, publication.id));
  expect(stored.count).toBe(2);
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, author.id)),
  ).toEqual([]);
});

function reviewedRevision(review: Awaited<ReturnType<typeof moderation.discussionDetail>>) {
  if (!review.comment) throw new Error("Expected current comment");
  return review.comment.revision;
}
