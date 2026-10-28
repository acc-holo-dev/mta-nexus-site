import { createHash, randomUUID } from "node:crypto";
import {
  authorContentRepository as author,
  contentRepository,
  db,
  communityModerationWorkspaceRepository as moderation,
  communityReportsRepository as reportsRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import { moderationDiscussionRevision } from "../packages/db/src/repositories/discussion-management";
import {
  auditEvents,
  comments,
  content,
  notifications,
  organizationMembers,
  organizations,
  reports,
  users,
} from "../packages/db/src/schema";

const actors: string[] = [],
  teams: string[] = [];
const id = (prefix: string) => `${prefix}_report_history_${randomUUID()}`;
afterEach(async () => {
  if (actors.length) await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
  if (teams.length) await db.delete(organizations).where(inArray(organizations.id, teams));
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  teams.length = 0;
});
async function user(role = "user") {
  const suffix = randomUUID().replaceAll("-", "");
  const row = await userRepository.create({
    id: id("usr"),
    username: `report_history_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Team editor",
    role,
  });
  actors.push(row.id);
  const currentToken = randomUUID();
  await sessionRepository.create({
    id: randomUUID(),
    userId: row.id,
    token: currentToken,
    expiresAt: new Date(Date.now() + 60_000),
  });
  return { ...row, currentToken };
}
async function fixture() {
  const original = await user(),
    owner = await user(),
    admin = await user(),
    reporter = await user(),
    staff = await user("moderator");
  const [team] = await db
    .insert(organizations)
    .values({ id: id("org"), slug: id("team"), name: "Team", ownerId: owner.id })
    .returning();
  teams.push(team.id);
  await db.insert(organizationMembers).values({
    id: id("member"),
    organizationId: team.id,
    userId: admin.id,
    role: "admin",
    permissions: [],
  });
  const item = await contentRepository.create({
    id: id("cnt"),
    slug: id("post"),
    authorId: original.id,
    organizationId: team.id,
    title: "Original",
    body: "Saved text",
    type: "post",
    status: "published",
    tags: ["lua"],
    viewCount: 7,
    likeCount: 3,
    commentCount: 0,
    publishedAt: new Date(),
  });
  return { original, owner, admin, reporter, staff, team, item };
}
const audit = (actorId: string, targetId: string, action: string, organizationId?: string) => ({
  id: id("aud"),
  actorId,
  actorType: "user" as const,
  action,
  targetType: "content",
  targetId,
  ...(organizationId ? { details: { organizationId } } : {}),
});
async function teamArchive(f: Awaited<ReturnType<typeof fixture>>) {
  await author.mutate(
    f.item.id,
    f.admin.id,
    f.item.updatedAt,
    "published",
    null,
    audit(f.admin.id, f.item.id, "content.archived_by_organization", f.team.id),
    f.team.id,
  );
  return author.history(f.item.id, f.owner.id, undefined, f.team.id);
}
async function report(actorId: string, commentId: string) {
  return reportsRepository.submit({
    id: id("rpt"),
    auditId: id("aud"),
    actorId,
    targetType: "comment",
    targetId: commentId,
    type: "spam",
    reason: "Detailed report reason",
    evidenceUrls: [],
  });
}
async function comment(f: Awaited<ReturnType<typeof fixture>>, text = "Reviewed text") {
  return contentRepository.addComment({
    id: id("cmt"),
    contentId: f.item.id,
    authorId: f.original.id,
    text,
    isVerifiedPurchase: false,
  });
}
function decision(
  f: Awaited<ReturnType<typeof fixture>>,
  reportId: string,
  commentId: string,
  text: string,
) {
  return {
    id: reportId,
    actorId: f.staff.id,
    currentToken: f.staff.currentToken,
    expectedStatus: "open" as const,
    action: "remove_comment" as const,
    notes: "Recorded reason",
    expectedRevision: moderationDiscussionRevision(
      f.item.id,
      commentId,
      createHash("sha256").update(text).digest("hex"),
    ),
    auditId: id("aud"),
    removalAuditId: id("aud"),
  };
}
it("restores another author's current team archive exactly once, preserving text/counts and protected draft visibility", async () => {
  const f = await fixture(),
    history = await teamArchive(f);
  expect(history.item.recoverable).toBe(true);
  // Archive remains recoverable when its original editor is removed; only current authority matters.
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, f.team.id),
        eq(organizationMembers.userId, f.admin.id),
      ),
    );
  const results = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      author.restore(
        f.item.id,
        f.owner.id,
        history.item.revision,
        audit(f.owner.id, f.item.id, "content.restored_by_organization"),
        f.team.id,
      ),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "CONFLICT" },
  });
  const [saved] = await db.select().from(content).where(eq(content.id, f.item.id));
  expect(saved).toMatchObject({
    authorId: f.original.id,
    organizationId: f.team.id,
    body: f.item.body,
    tags: ["lua"],
    status: "draft",
    publishedAt: null,
    viewCount: 7,
    likeCount: 3,
  });
  expect(
    await contentRepository.findPublishedBySlug(f.item.slug, { incrementView: false }),
  ).toBeNull();
});
it("denies revoked team admins, protected moderator archives and legacy archives without current proof", async () => {
  const f = await fixture(),
    history = await teamArchive(f);
  await db
    .update(organizationMembers)
    .set({ role: "developer" })
    .where(
      and(
        eq(organizationMembers.organizationId, f.team.id),
        eq(organizationMembers.userId, f.admin.id),
      ),
    );
  await expect(
    author.restore(
      f.item.id,
      f.admin.id,
      history.item.revision,
      audit(f.admin.id, f.item.id, "content.restored_by_organization"),
      f.team.id,
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await db.insert(auditEvents).values({
    ...audit(f.staff.id, f.item.id, "content.archived"),
    actorType: "admin",
    createdAt: new Date(Date.now() + 1000),
  });
  await expect(
    author.restore(
      f.item.id,
      f.owner.id,
      history.item.revision,
      audit(f.owner.id, f.item.id, "content.restored_by_organization"),
      f.team.id,
    ),
  ).rejects.toMatchObject({ code: "PUBLICATION_RESTORE_DENIED" });
  await db.delete(auditEvents).where(eq(auditEvents.targetId, f.item.id));
  await expect(
    author.restore(
      f.item.id,
      f.owner.id,
      history.item.revision,
      audit(f.owner.id, f.item.id, "content.restored_by_organization"),
      f.team.id,
    ),
  ).rejects.toMatchObject({ code: "PUBLICATION_RESTORE_DENIED" });
});
it("rolls back draft restoration if its mandatory audit fails", async () => {
  const f = await fixture(),
    history = await teamArchive(f),
    duplicate = audit(f.owner.id, f.item.id, "fixture.audit");
  await db.insert(auditEvents).values(duplicate);
  await expect(
    author.restore(f.item.id, f.owner.id, history.item.revision, duplicate, f.team.id),
  ).rejects.toThrow();
  expect((await author.history(f.item.id, f.owner.id, undefined, f.team.id)).item).toMatchObject({
    status: "archived",
    revision: history.item.revision,
    recoverable: true,
  });
});
it("removes an archived comment with full Unicode version, keeps other reports pending and notifies its author atomically", async () => {
  const f = await fixture(),
    text = `${"🙂".repeat(5000)}tail`,
    c = await comment(f, text),
    first = await report(f.reporter.id, c.id),
    second = await report(f.owner.id, c.id);
  await db.update(content).set({ status: "archived" }).where(eq(content.id, f.item.id));
  const preview = await reportsRepository.detail({ actorId: f.staff.id, staff: true }, first.id);
  expect(Array.from(preview.target?.text ?? "")).toHaveLength(5000);
  expect(preview.target?.revision).toBe(decision(f, first.id, c.id, text).expectedRevision);
  await reportsRepository.decide(decision(f, first.id, c.id, text));
  const [other] = await db.select().from(reports).where(eq(reports.id, second.id));
  expect(other.status).toBe("open");
  const pending = await moderation.discussionReports(f.staff.id, f.item.id, c.id, {
    query: "",
    view: "pending",
  });
  expect(pending.removed).toBe(true);
  expect(pending.items.map((item) => item.id)).toEqual([second.id]);
  expect(
    await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, f.original.id),
          eq(notifications.link, "/workspace/discussions"),
        ),
      ),
  ).toHaveLength(1);
  const staff = await reportsRepository.detail({ actorId: f.staff.id, staff: true }, second.id);
  expect(staff.moderationContentId).toBe(f.item.id);
  const own = await reportsRepository.detail({ actorId: f.owner.id, staff: false }, second.id);
  expect(own).not.toHaveProperty("moderationContentId");
});
it("rolls back comment/counter/notification when the later report audit fails", async () => {
  const f = await fixture(),
    c = await comment(f),
    r = await report(f.reporter.id, c.id),
    duplicate = audit(f.staff.id, f.item.id, "fixture.audit");
  await db.insert(auditEvents).values(duplicate);
  const command = { ...decision(f, r.id, c.id, c.text), auditId: duplicate.id };
  await expect(reportsRepository.decide(command)).rejects.toThrow();
  expect(await db.select().from(comments).where(eq(comments.id, c.id))).toHaveLength(1);
  expect((await db.select().from(content).where(eq(content.id, f.item.id)))[0].commentCount).toBe(
    1,
  );
  expect((await db.select().from(reports).where(eq(reports.id, r.id)))[0].status).toBe("open");
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, f.original.id)),
  ).toHaveLength(0);
});
it("paginates exact microsecond report ties without duplication and refuses forged deleted targets", async () => {
  const f = await fixture(),
    c = await comment(f),
    time = "2026-10-11T00:00:00.123456Z";
  await db.insert(reports).values(
    Array.from({ length: 21 }, (_, i) => ({
      id: `rpt_history_${randomUUID()}_${i}`,
      reporterId: f.reporter.id,
      targetType: "comment",
      targetId: c.id,
      type: "spam",
      reason: "Detailed reason",
      status: "open",
      createdAt: sql`${time}::timestamptz`,
    })),
  );
  const first = await moderation.discussionReports(f.staff.id, f.item.id, c.id, {
    query: "",
    view: "pending",
  });
  if (!first.nextCursor) throw Error("Missing continuation");
  const second = await moderation.discussionReports(f.staff.id, f.item.id, c.id, {
    query: "",
    view: "pending",
    cursor: { ...first.nextCursor, context: first.context },
  });
  expect(first.items).toHaveLength(20);
  expect(second.items).toHaveLength(1);
  expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(21);
  expect(first.nextCursor.createdAt).toBe(time);
  await db.delete(comments).where(eq(comments.id, c.id));
  await expect(
    moderation.discussionReports(f.staff.id, f.item.id, c.id, { query: "", view: "pending" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
