import { randomUUID } from "node:crypto";
import {
  authorContentRepository as author,
  auditEvents,
  comments,
  communityReportsRepository as reportsRepository,
  content,
  db,
  notifications,
  organizationMembers,
  organizations,
  reports,
  serverContentRepository as serverContent,
  servers,
  sessionRepository,
  userRepository,
  users,
} from "@nexus/db";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach } from "vitest";

export {
  and,
  author,
  auditEvents,
  comments,
  content,
  db,
  eq,
  inArray,
  notifications,
  organizationMembers,
  reports,
  reportsRepository,
};

const actors: string[] = [],
  teamIds: string[] = [],
  serverIds: string[] = [];

/** Build a disposable id prefixed for server-report-batch fixtures. */
export const id = (prefix: string) => `${prefix}_server_batch_${randomUUID()}`;

/** Register shared afterEach cleanup for server-report-batch persistence suites. */
export function setupServerReportBatchPersistence() {
  afterEach(async () => {
    if (actors.length) await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    if (serverIds.length) await db.delete(servers).where(inArray(servers.id, serverIds));
    if (teamIds.length) await db.delete(organizations).where(inArray(organizations.id, teamIds));
    if (actors.length) await db.delete(users).where(inArray(users.id, actors));
    actors.length = 0;
    teamIds.length = 0;
    serverIds.length = 0;
  });
}

/** Create a disposable actor with a live initiating session. */
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

/** Audit envelope used by server content and restore commands. */
export const audit = (actorId: string, targetId: string, action: string, serverId?: string) => ({
  id: id("aud"),
  actorId,
  actorType: "user" as const,
  action,
  targetType: "content",
  targetId,
  ...(serverId ? { details: { serverId } } : {}),
});

/** Seed owner/manager/writer/reporter/staff, published server post, and three open comment reports. */
export async function fixture() {
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
    writer.currentToken,
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
  async function submit(actor: { id: string; currentToken: string }) {
    return reportsRepository.submit({
      id: id("rpt"),
      auditId: id("aud"),
      actorId: actor.id,
      currentToken: actor.currentToken,
      targetType: "comment",
      targetId: c[0].id,
      type: "spam",
      reason: "Recorded report reason",
      evidenceUrls: [],
    });
  }
  const a = await submit(reporter),
    b = await submit(owner),
    third = await submit(manager);
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

/** Two-report resolve selection used by batch decision suites. */
export const selection = (f: Awaited<ReturnType<typeof fixture>>) => ({
  items: [
    { id: f.a.id, expectedStatus: "open" as const },
    { id: f.b.id, expectedStatus: "open" as const },
  ],
  action: "resolve" as const,
  notes: "Reviewed recorded reason",
});

/** Preview the shared two-report resolve selection for a fixture. */
export async function preview(f: Awaited<ReturnType<typeof fixture>>) {
  return reportsRepository.previewDiscussionBatch(
    f.staff.id,
    f.item.id,
    f.comment.id,
    selection(f),
  );
}
