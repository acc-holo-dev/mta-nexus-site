import { randomUUID } from "node:crypto";
import {
  auditEvents,
  comments,
  content,
  db,
  communityReportsRepository as repo,
  reports,
  userRepository,
  users,
} from "@nexus/db";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import { sessionRepository } from "../packages/db/src/repositories/sessions";

const actors: string[] = [],
  publications: string[] = [],
  reportIds: string[] = [],
  base = { period: "all" as const, group: "all" as const, query: "", view: "pending" as const };
const id = (prefix: string) => `${prefix}_${randomUUID()}`;
afterEach(async () => {
  if (reportIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, reportIds));
    await db.delete(reports).where(inArray(reports.id, reportIds));
  }
  if (publications.length) await db.delete(content).where(inArray(content.id, publications));
  if (actors.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    await db.delete(users).where(inArray(users.id, actors));
  }
  actors.length = 0;
  publications.length = 0;
  reportIds.length = 0;
});
async function actor(role: "user" | "moderator" = "user") {
  const suffix = randomUUID().replaceAll("-", "");
  const row = await userRepository.create({
    id: `usr_groups_${suffix}`,
    username: `groups_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Group fixture",
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
async function publication(authorId: string) {
  const key = id("cnt");
  publications.push(key);
  await db.insert(content).values({
    id: key,
    slug: id("post"),
    title: "Group fixture",
    body: "Original publication body",
    authorId,
    type: "post",
    status: "published",
  });
  return key;
}
async function report(
  ownerId: string,
  targetId: string,
  targetType = "content",
  status = "open",
  createdAt?: string,
) {
  const key = id("rpt");
  reportIds.push(key);
  await db.insert(reports).values({
    id: key,
    reporterId: ownerId,
    targetType,
    targetId,
    type: "spam",
    reason: "100%_\\ literal reason",
    status,
    ...(createdAt ? { createdAt: sql`${createdAt}::timestamptz` } : {}),
  });
  return key;
}
async function clock() {
  return (
    await db.execute<{ time: string }>(
      sql`select to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as time`,
    )
  )[0].time;
}
it("groups matching report states by exact content/comment targets, keeps literal filters and excludes commercial targets", async () => {
  const owner = await actor(),
    staff = await actor("moderator"),
    post = await publication(owner.id),
    comment = id("cmt");
  await db
    .insert(comments)
    .values({ id: comment, contentId: post, authorId: owner.id, text: "Comment context" });
  await report(owner.id, post);
  await report(owner.id, post, "content", "under_review");
  await report(owner.id, post, "content", "resolved");
  await report(owner.id, comment, "comment");
  await report(owner.id, "commercial-target", "product");
  const page = await repo.groups(staff.id, { ...base, query: "100%_\\" });
  expect(page.items).toHaveLength(2);
  expect(page.items.find((item) => item.targetType === "content")).toMatchObject({
    open: 1,
    review: 1,
    resolved: 1,
    dismissed: 0,
    target: { contentId: post },
  });
  expect(page.items.find((item) => item.targetType === "comment")?.target?.text).toBe(
    "Comment context",
  );
  expect(
    (await repo.groups(staff.id, { ...base, view: "history" })).items.map((item) => item.targetId),
  ).toEqual([post]);
  await expect(repo.groups(owner.id, base)).rejects.toMatchObject({ statusCode: 403 });
});
it("traverses forty-five tied groups once and retains its event-time cutoff when new reports arrive", async () => {
  const owner = await actor(),
    staff = await actor("moderator"),
    time = await clock(),
    targets: string[] = [];
  for (let index = 0; index < 45; index++) {
    const post = await publication(owner.id);
    targets.push(post);
    await report(owner.id, post, "content", "open", time);
  }
  const first = await repo.groups(staff.id, base);
  expect(first.items).toHaveLength(20);
  expect(first.items[0].firstAt).toBe(time);
  if (!first.nextCursor) throw Error("Missing first cursor");
  const second = await repo.groups(staff.id, { ...base, cursor: first.nextCursor });
  if (!second.nextCursor) throw Error("Missing second cursor");
  const third = await repo.groups(staff.id, { ...base, cursor: second.nextCursor });
  expect(third.items).toHaveLength(5);
  expect(
    new Set([...first.items, ...second.items, ...third.items].map((item) => item.targetId)),
  ).toEqual(new Set(targets));
  await report(owner.id, second.items[0].targetId);
  const retained = await repo.groups(staff.id, { ...base, cursor: first.nextCursor });
  expect(retained.items.map((item) => [item.targetId, item.open])).toEqual(
    second.items.map((item) => [item.targetId, item.open]),
  );
  expect(retained.until).toBe(first.until);
  await expect(
    repo.groups(staff.id, { ...base, view: "history", cursor: first.nextCursor }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  const anchorTarget = first.items.at(-1)?.targetId;
  if (!anchorTarget) throw Error("Missing target");
  await db.update(reports).set({ status: "resolved" }).where(eq(reports.targetId, anchorTarget));
  await expect(repo.groups(staff.id, { ...base, cursor: first.nextCursor })).rejects.toMatchObject({
    code: "REPORT_GROUPS_EXPIRED",
  });
});
it("stores all reviewed publication decisions atomically, records history and preserves the publication state", async () => {
  const owner = await actor(),
    staff = await actor("moderator"),
    post = await publication(owner.id),
    first = await report(owner.id, post),
    second = await report(owner.id, post, "content", "under_review");
  const input = {
    items: [
      { id: first, expectedStatus: "open" as const },
      { id: second, expectedStatus: "under_review" as const },
    ],
    action: "resolve" as const,
    notes: "PRIVATE_PUBLICATION_REASON",
  };
  const preview = await repo.previewPublicationBatch(staff.id, post, input);
  expect(preview.commentId).toBeNull();
  expect(preview.publication.text).toBe("Original publication body");
  const result = await repo.decidePublicationBatch(
    staff.id,
    post,
    { ...input, previewRevision: preview.previewRevision },
    input.items.map(() => id("aud")),
    staff.currentToken,
  );
  expect(result.items.every((item) => item.status === "resolved")).toBe(true);
  expect((await db.select().from(content).where(eq(content.id, post)))[0].status).toBe("published");
  const history = await repo.history({ actorId: owner.id, staff: false }, first, {
    period: "all",
    group: "all",
    query: "",
  });
  expect(history.items[0]).toMatchObject({ action: "report.resolve", to: "resolved" });
  expect(JSON.stringify(history)).not.toContain("PRIVATE_PUBLICATION_REASON");
  expect(
    (await repo.publicationReports(staff.id, post, { page: 1, view: "history", query: "" })).items,
  ).toHaveLength(2);
});
it("rejects full-publication edits and revoked grants after preview and rolls back mandatory audit failures", async () => {
  const owner = await actor(),
    staff = await actor("moderator"),
    post = await publication(owner.id),
    key = await report(owner.id, post),
    input = {
      items: [{ id: key, expectedStatus: "open" as const }],
      action: "dismiss" as const,
      notes: "Recorded reason",
    };
  const preview = await repo.previewPublicationBatch(staff.id, post, input);
  await db
    .update(content)
    .set({ body: "Changed beyond the reviewed text", updatedAt: sql`clock_timestamp()` })
    .where(eq(content.id, post));
  await expect(
    repo.decidePublicationBatch(
      staff.id,
      post,
      { ...input, previewRevision: preview.previewRevision },
      [id("aud")],
      staff.currentToken,
    ),
  ).rejects.toMatchObject({ code: "REPORT_BATCH_CHANGED" });
  const reviewed = await repo.previewPublicationBatch(staff.id, post, input),
    duplicate = id("aud");
  await db.insert(auditEvents).values({
    id: duplicate,
    actorId: staff.id,
    actorType: "admin",
    action: "fixture",
    targetType: "report",
    targetId: key,
  });
  await expect(
    repo.decidePublicationBatch(
      staff.id,
      post,
      { ...input, previewRevision: reviewed.previewRevision },
      [duplicate],
      staff.currentToken,
    ),
  ).rejects.toThrow();
  expect((await db.select().from(reports).where(eq(reports.id, key)))[0].status).toBe("open");
  await db.update(users).set({ role: "user" }).where(eq(users.id, staff.id));
  await expect(
    repo.decidePublicationBatch(
      staff.id,
      post,
      { ...input, previewRevision: reviewed.previewRevision },
      [id("aud")],
      staff.currentToken,
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
});
