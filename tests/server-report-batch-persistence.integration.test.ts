import { randomUUID } from "node:crypto";
import {
  authorContentRepository as author,
  db,
  communityReportsRepository as reportsRepository,
  serverContentRepository as serverContent,
  userRepository,
} from "@nexus/db";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import { sessionRepository } from "../packages/db/src/repositories/sessions";
import {
  auditEvents,
  comments,
  content,
  notifications,
  organizationMembers,
  organizations,
  reports,
  servers,
  users,
} from "../packages/db/src/schema";

const actors: string[] = [],
  teamIds: string[] = [],
  serverIds: string[] = [];
const id = (prefix: string) => `${prefix}_server_batch_${randomUUID()}`;
afterEach(async () => {
  if (actors.length) await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
  if (serverIds.length) await db.delete(servers).where(inArray(servers.id, serverIds));
  if (teamIds.length) await db.delete(organizations).where(inArray(organizations.id, teamIds));
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  teamIds.length = 0;
  serverIds.length = 0;
});
async function user(role = "user") {
  const suffix = randomUUID().replaceAll("-", "");
  const actor = await userRepository.create({
    id: id("usr"),
    username: `server_batch_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Server manager",
    role,
  });
  actors.push(actor.id);
  const currentToken = randomUUID();
  await sessionRepository.create({
    id: randomUUID(),
    userId: actor.id,
    token: currentToken,
    expiresAt: new Date(Date.now() + 60_000),
  });
  return { ...actor, currentToken };
}
const audit = (actorId: string, targetId: string, action: string, serverId?: string) => ({
  id: id("aud"),
  actorId,
  actorType: "user" as const,
  action,
  targetType: "content",
  targetId,
  ...(serverId ? { details: { serverId } } : {}),
});
async function fixture() {
  const owner = await user(),
    manager = await user(),
    writer = await user(),
    reporter = await user(),
    staff = await user("moderator");
  const [org] = await db
    .insert(organizations)
    .values({ id: id("org"), slug: id("team"), name: "Team", ownerId: owner.id })
    .returning();
  teamIds.push(org.id);
  await db.insert(organizationMembers).values({
    id: id("member"),
    organizationId: org.id,
    userId: manager.id,
    role: "developer",
    permissions: ["manage_servers"],
  });
  const [server] = await db
    .insert(servers)
    .values({
      id: id("srv"),
      slug: id("server"),
      name: "Server",
      ipAddress: "203.0.113.22",
      port: 22003,
      ownerId: owner.id,
      organizationId: org.id,
    })
    .returning();
  serverIds.push(server.id);
  // The author and current manager are distinct, with live server grants at creation.
  await db.insert(organizationMembers).values({
    id: id("member"),
    organizationId: org.id,
    userId: writer.id,
    role: "developer",
    permissions: ["manage_servers"],
  });
  const itemId = id("cnt");
  const item = await serverContent.create(
    server.id,
    writer.id,
    {
      id: itemId,
      slug: id("post"),
      title: "Title",
      body: "Original full text",
      type: "article",
      authorId: writer.id,
      status: "draft",
      tags: ["lua"],
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
    },
    audit(writer.id, itemId, "content.created_by_server", server.id),
  );
  // Tests start from a retained public editorial publication, as moderator approval would establish.
  const [published] = await db
    .update(content)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(content.id, item.id))
    .returning();
  const c = await db
    .insert(comments)
    .values({
      id: id("cmt"),
      contentId: item.id,
      authorId: writer.id,
      text: "Current complete comment",
    })
    .returning();
  await db.update(content).set({ commentCount: 1 }).where(eq(content.id, item.id));
  async function submit(actorId: string) {
    return reportsRepository.submit({
      id: id("rpt"),
      auditId: id("aud"),
      actorId,
      targetType: "comment",
      targetId: c[0].id,
      type: "spam",
      reason: "Recorded report reason",
      evidenceUrls: [],
    });
  }
  const a = await submit(reporter.id),
    b = await submit(owner.id),
    third = await submit(manager.id);
  return {
    owner,
    manager,
    writer,
    reporter,
    staff,
    org,
    server,
    item: published,
    comment: c[0],
    a,
    b,
    third,
  };
}
const selection = (f: Awaited<ReturnType<typeof fixture>>) => ({
  items: [
    { id: f.a.id, expectedStatus: "open" as const },
    { id: f.b.id, expectedStatus: "open" as const },
  ],
  action: "resolve" as const,
  notes: "Reviewed recorded reason",
});
async function preview(f: Awaited<ReturnType<typeof fixture>>) {
  return reportsRepository.previewDiscussionBatch(
    f.staff.id,
    f.item.id,
    f.comment.id,
    selection(f),
  );
}
it("atomically decides only the selected reports, keeps comment/count and records one audit per case", async () => {
  const f = await fixture(),
    reviewed = await preview(f);
  await reportsRepository.decideDiscussionBatch(
    f.staff.id,
    f.item.id,
    f.comment.id,
    { ...selection(f), previewRevision: reviewed.previewRevision },
    [id("aud"), id("aud")],
    f.staff.currentToken,
  );
  const stored = await db
    .select()
    .from(reports)
    .where(inArray(reports.id, [f.a.id, f.b.id, f.third.id]));
  expect(
    stored
      .filter((row) => row.status === "resolved")
      .map((row) => row.id)
      .sort(),
  ).toEqual([f.a.id, f.b.id].sort());
  expect(stored.find((row) => row.id === f.third.id)?.status).toBe("open");
  expect(await db.select().from(comments).where(eq(comments.id, f.comment.id))).toHaveLength(1);
  expect((await db.select().from(content).where(eq(content.id, f.item.id)))[0].commentCount).toBe(
    1,
  );
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.actorId, f.staff.id), eq(auditEvents.action, "report.resolve"))),
  ).toHaveLength(2);
});
it("permits one concurrent reviewed batch outcome and refuses edits beyond a bounded comment preview", async () => {
  const f = await fixture(),
    text = `${"🙂".repeat(5000)}original-tail`;
  await db.update(comments).set({ text }).where(eq(comments.id, f.comment.id));
  const reviewed = await preview(f);
  expect(reviewed.comment?.truncated).toBe(true);
  await db
    .update(comments)
    .set({ text: `${"🙂".repeat(5000)}changed-tail` })
    .where(eq(comments.id, f.comment.id));
  await expect(
    reportsRepository.decideDiscussionBatch(
      f.staff.id,
      f.item.id,
      f.comment.id,
      { ...selection(f), previewRevision: reviewed.previewRevision },
      [id("aud"), id("aud")],
      f.staff.currentToken,
    ),
  ).rejects.toMatchObject({ code: "REPORT_BATCH_CHANGED" });
  const fresh = await preview(f);
  const results = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      reportsRepository.decideDiscussionBatch(
        f.staff.id,
        f.item.id,
        f.comment.id,
        { ...selection(f), previewRevision: fresh.previewRevision },
        [id("aud"), id("aud")],
        f.staff.currentToken,
      ),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "REPORT_STATE_CHANGED" },
  });
});
it("rolls back the entire batch if any mandatory audit cannot be stored", async () => {
  const f = await fixture(),
    reviewed = await preview(f),
    duplicate = audit(f.staff.id, f.item.id, "fixture.audit");
  await db.insert(auditEvents).values(duplicate);
  await expect(
    reportsRepository.decideDiscussionBatch(
      f.staff.id,
      f.item.id,
      f.comment.id,
      { ...selection(f), previewRevision: reviewed.previewRevision },
      [id("aud"), duplicate.id],
      f.staff.currentToken,
    ),
  ).rejects.toThrow();
  const stored = await db
    .select()
    .from(reports)
    .where(inArray(reports.id, [f.a.id, f.b.id]));
  expect(stored.every((row) => row.status === "open" && row.moderatorNotes === null)).toBe(true);
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.actorId, f.staff.id), eq(auditEvents.action, "report.resolve"))),
  ).toHaveLength(0);
});
it("restores a delegated server archive once under current grants without changing attribution or original text", async () => {
  const f = await fixture();
  await author.mutate(
    f.item.id,
    f.manager.id,
    f.item.updatedAt,
    "published",
    null,
    audit(f.manager.id, f.item.id, "content.archived_by_server", f.server.id),
    undefined,
    f.server.id,
  );
  const history = await author.history(f.item.id, f.manager.id, undefined, undefined, f.server.id);
  expect(history.item.recoverable).toBe(true);
  const results = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      author.restore(
        f.item.id,
        f.manager.id,
        history.item.revision,
        audit(f.manager.id, f.item.id, "content.restored_by_server", f.server.id),
        undefined,
        f.server.id,
      ),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const [stored] = await db.select().from(content).where(eq(content.id, f.item.id));
  expect(stored).toMatchObject({
    authorId: f.writer.id,
    serverId: f.server.id,
    body: "Original full text",
    tags: ["lua"],
    status: "draft",
    publishedAt: null,
    commentCount: 1,
  });
  expect(await db.select().from(comments).where(eq(comments.id, f.comment.id))).toHaveLength(1);
});
it("revoked delegation and moderator-protected archives cannot be restored by old managers", async () => {
  const f = await fixture();
  await author.mutate(
    f.item.id,
    f.manager.id,
    f.item.updatedAt,
    "published",
    null,
    audit(f.manager.id, f.item.id, "content.archived_by_server", f.server.id),
    undefined,
    f.server.id,
  );
  const history = await author.history(f.item.id, f.manager.id, undefined, undefined, f.server.id);
  await db
    .update(organizationMembers)
    .set({ permissions: [] })
    .where(
      and(
        eq(organizationMembers.organizationId, f.org.id),
        eq(organizationMembers.userId, f.manager.id),
      ),
    );
  await expect(
    author.restore(
      f.item.id,
      f.manager.id,
      history.item.revision,
      audit(f.manager.id, f.item.id, "content.restored_by_server"),
      undefined,
      f.server.id,
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    author.history(f.item.id, f.manager.id, undefined, undefined, f.server.id),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
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
      audit(f.owner.id, f.item.id, "content.restored_by_server"),
      undefined,
      f.server.id,
    ),
  ).rejects.toMatchObject({ code: "PUBLICATION_RESTORE_DENIED" });
});
it("server restore audit failure rolls back its draft and inbox changes", async () => {
  const f = await fixture();
  await author.mutate(
    f.item.id,
    f.manager.id,
    f.item.updatedAt,
    "published",
    null,
    audit(f.manager.id, f.item.id, "content.archived_by_server", f.server.id),
    undefined,
    f.server.id,
  );
  const history = await author.history(f.item.id, f.manager.id, undefined, undefined, f.server.id),
    duplicate = audit(f.manager.id, f.item.id, "fixture.audit");
  await db.insert(auditEvents).values(duplicate);
  const before = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, f.writer.id));
  await expect(
    author.restore(
      f.item.id,
      f.manager.id,
      history.item.revision,
      duplicate,
      undefined,
      f.server.id,
    ),
  ).rejects.toThrow();
  expect(
    (await author.history(f.item.id, f.owner.id, undefined, undefined, f.server.id)).item,
  ).toMatchObject({ status: "archived", revision: history.item.revision });
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, f.writer.id)),
  ).toHaveLength(before.length);
});
