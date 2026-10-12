import { randomUUID } from "node:crypto";
import {
  auditEvents,
  comments,
  content,
  db,
  reports,
  communityReportsRepository as repository,
  userRepository,
  users,
} from "@nexus/db";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";

const actorIds: string[] = [],
  publicationIds: string[] = [],
  reportIds: string[] = [];
const key = (prefix: string) => `${prefix}_${randomUUID()}`,
  base = { period: "all" as const, group: "all" as const, query: "" };
afterEach(async () => {
  if (reportIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, reportIds));
    await db.delete(reports).where(inArray(reports.id, reportIds));
  }
  if (publicationIds.length) await db.delete(content).where(inArray(content.id, publicationIds));
  if (actorIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actorIds));
    await db.delete(users).where(inArray(users.id, actorIds));
  }
  actorIds.length = 0;
  publicationIds.length = 0;
  reportIds.length = 0;
});
async function actor(role: "user" | "moderator" = "user") {
  const suffix = randomUUID().replaceAll("-", "");
  const value = await userRepository.create({
    id: `usr_report_journal_${suffix}`,
    username: `rjournal_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Journal actor",
    role,
  });
  actorIds.push(value.id);
  return value;
}
async function fixture() {
  const author = await actor(),
    owner = await actor(),
    staff = await actor("moderator");
  const id = key("cnt");
  publicationIds.push(id);
  await db.insert(content).values({
    id,
    slug: key("post"),
    title: "Private report history fixture",
    body: "Publication body",
    authorId: author.id,
    status: "published",
    type: "post",
  });
  const commentId = key("cmt");
  await db
    .insert(comments)
    .values({ id: commentId, contentId: id, authorId: author.id, text: "Comment body" });
  const report = await submit(owner.id, commentId);
  return { author, owner, staff, id, commentId, report };
}
async function submit(actorId: string, commentId: string) {
  const id = key("rpt");
  reportIds.push(id);
  return repository.submit({
    id,
    actorId,
    auditId: key("aud"),
    targetType: "comment",
    targetId: commentId,
    type: "abuse",
    reason: "Recorded violation 100%_\\",
    evidenceUrls: [],
  });
}
async function clock() {
  return (
    await db.execute<{ time: string }>(
      sql`select to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as time`,
    )
  )[0].time;
}
it("shows durable submission/review/resolution stages while keeping all staff notes and identities out of requester receipts", async () => {
  const f = await fixture();
  await repository.decide({
    id: f.report.id,
    actorId: f.staff.id,
    expectedStatus: "open",
    action: "review",
    notes: "PRIVATE_REVIEW_NOTE",
    auditId: key("aud"),
    removalAuditId: key("aud"),
  });
  await repository.decide({
    id: f.report.id,
    actorId: f.staff.id,
    expectedStatus: "under_review",
    action: "resolve",
    notes: "PRIVATE_RESOLUTION_NOTE",
    auditId: key("aud"),
    removalAuditId: key("aud"),
  });
  const own = await repository.history({ actorId: f.owner.id, staff: false }, f.report.id, base),
    staff = await repository.history({ actorId: f.staff.id, staff: true }, f.report.id, base);
  expect(own.items.map((event) => event.action)).toEqual([
    "report.resolve",
    "report.review",
    "report.created",
  ]);
  expect(own.items[0]).toMatchObject({ from: "under_review", to: "resolved", by: "staff" });
  expect(staff.items[0]).toMatchObject({ notes: "PRIVATE_RESOLUTION_NOTE", batchSize: null });
  expect(JSON.stringify(own)).not.toMatch(
    /PRIVATE_|reporterId|actorId|notes|batchSize|reason|evidenceUrls/u,
  );
  expect(JSON.stringify(own)).not.toContain(f.staff.id);
  const stranger = await actor();
  await expect(
    repository.history({ actorId: stranger.id, staff: false }, f.report.id, base),
  ).rejects.toMatchObject({ statusCode: 404 });
  await db.update(users).set({ role: "user" }).where(eq(users.id, f.staff.id));
  await expect(
    repository.history({ actorId: f.staff.id, staff: true }, f.report.id, base),
  ).rejects.toMatchObject({ statusCode: 403 });
});
it("traverses forty-five tied events once, retains its cutoff and rejects reused or deleted anchors", async () => {
  const f = await fixture(),
    time = await clock(),
    ids = Array.from({ length: 45 }, () => key("aud")),
    filters = { ...base, group: "review" as const };
  await db.insert(auditEvents).values(
    ids.map((id) => ({
      id,
      actorId: f.staff.id,
      actorType: "admin",
      action: "report.review",
      targetType: "report",
      targetId: f.report.id,
      details: { previousStatus: "open", status: "under_review", notes: "PRIVATE_NOTE" },
      createdAt: sql`${time}::timestamptz`,
    })),
  );
  const first = await repository.history(
    { actorId: f.owner.id, staff: false },
    f.report.id,
    filters,
  );
  if (!first.nextCursor) throw Error("Missing cursor");
  expect(first.items).toHaveLength(20);
  expect(first.items[0].createdAt).toBe(time);
  const second = await repository.history({ actorId: f.owner.id, staff: false }, f.report.id, {
    ...filters,
    cursor: first.nextCursor,
  });
  if (!second.nextCursor) throw Error("Missing second cursor");
  const third = await repository.history({ actorId: f.owner.id, staff: false }, f.report.id, {
    ...filters,
    cursor: second.nextCursor,
  });
  expect(third.items).toHaveLength(5);
  expect(
    new Set([...first.items, ...second.items, ...third.items].map((event) => event.id)),
  ).toEqual(new Set(ids));
  await db.insert(auditEvents).values({
    id: key("aud"),
    actorId: f.staff.id,
    actorType: "admin",
    action: "report.review",
    targetType: "report",
    targetId: f.report.id,
    details: { status: "under_review" },
  });
  const retained = await repository.history({ actorId: f.owner.id, staff: false }, f.report.id, {
    ...filters,
    cursor: first.nextCursor,
  });
  expect(retained.items).toEqual(second.items);
  expect(retained.until).toBe(first.until);
  await expect(
    repository.history({ actorId: f.owner.id, staff: false }, f.report.id, {
      ...base,
      cursor: first.nextCursor,
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  await expect(
    repository.history({ actorId: f.staff.id, staff: true }, f.report.id, {
      ...filters,
      cursor: first.nextCursor,
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  await db.delete(auditEvents).where(eq(auditEvents.id, first.nextCursor.id));
  await expect(
    repository.history({ actorId: f.owner.id, staff: false }, f.report.id, {
      ...filters,
      cursor: first.nextCursor,
    }),
  ).rejects.toMatchObject({ code: "REPORT_HISTORY_EXPIRED" });
});
it("keeps malformed legacy evidence neutral, bounds Unicode notes and excludes noncommunity targets", async () => {
  const f = await fixture();
  await db.insert(auditEvents).values({
    id: key("aud"),
    actorId: f.staff.id,
    actorType: "system",
    action: "report.remove_comment",
    targetType: "report",
    targetId: f.report.id,
    details: {
      previousStatus: "invalid",
      status: "dismissed",
      removedCommentId: 123,
      notes: { secret: "PRIVATE_RAW" },
      batchSize: "20",
      ipAddress: "PRIVATE_IP",
    },
  });
  const own = await repository.history({ actorId: f.owner.id, staff: false }, f.report.id, base);
  expect(own.items[0]).toMatchObject({ from: null, to: null, by: "unknown", removed: false });
  const staff = await repository.history({ actorId: f.staff.id, staff: true }, f.report.id, base);
  expect(staff.items[0]).toMatchObject({ notes: null, batchSize: null });
  expect(JSON.stringify(staff)).not.toMatch(/PRIVATE_RAW|PRIVATE_IP/u);
  await db.insert(auditEvents).values({
    id: key("aud"),
    actorId: f.staff.id,
    actorType: "admin",
    action: "report.review",
    targetType: "report",
    targetId: f.report.id,
    details: { status: "under_review", notes: "😀".repeat(2000), batchSize: 10000 },
  });
  const bounded = await repository.history({ actorId: f.staff.id, staff: true }, f.report.id, base);
  expect(bounded.items[0]).toMatchObject({ notes: "😀".repeat(1000), batchSize: null });
  const commercial = key("rpt");
  reportIds.push(commercial);
  await db.insert(reports).values({
    id: commercial,
    reporterId: f.owner.id,
    targetType: "product",
    targetId: "commercial-target",
    type: "abuse",
    reason: "Private commercial report",
  });
  await expect(
    repository.history({ actorId: f.staff.id, staff: true }, commercial, base),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(
    (
      await repository.page(
        { actorId: f.owner.id, staff: false },
        { page: 1, view: "pending", query: "100%_\\" },
      )
    ).items.map((row) => row.id),
  ).toEqual([f.report.id]);
});
it("retains real batch decision context only for staff and preserves requester history after comment removal", async () => {
  const f = await fixture(),
    other = await actor(),
    second = await submit(other.id, f.commentId);
  const input = {
    items: [
      { id: f.report.id, expectedStatus: "open" as const },
      { id: second.id, expectedStatus: "open" as const },
    ],
    action: "dismiss" as const,
    notes: "PRIVATE_BATCH_NOTE",
  };
  const preview = await repository.previewDiscussionBatch(f.staff.id, f.id, f.commentId, input);
  await repository.decideDiscussionBatch(
    f.staff.id,
    f.id,
    f.commentId,
    { ...input, previewRevision: preview.previewRevision },
    input.items.map(() => key("aud")),
  );
  expect(
    (await repository.history({ actorId: f.staff.id, staff: true }, f.report.id, base)).items[0],
  ).toMatchObject({ batchSize: 2, notes: "PRIVATE_BATCH_NOTE" });
  await db.delete(comments).where(eq(comments.id, f.commentId));
  const own = await repository.history({ actorId: f.owner.id, staff: false }, f.report.id, base);
  expect(own.report.status).toBe("dismissed");
  expect(JSON.stringify(own)).not.toMatch(/PRIVATE_BATCH_NOTE|batchSize/u);
});
