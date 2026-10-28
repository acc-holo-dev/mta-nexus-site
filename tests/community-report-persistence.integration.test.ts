import { randomUUID } from "node:crypto";
import {
  db,
  discussionRevision,
  communityReportsRepository as repository,
  userRepository,
} from "@nexus/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import { sessionRepository } from "../packages/db/src/repositories/sessions";
import {
  auditEvents,
  comments,
  content,
  products,
  reports,
  users,
} from "../packages/db/src/schema";

const actors: string[] = [],
  productIds: string[] = [];
const id = (prefix: string) => `${prefix}_report_${randomUUID()}`;
afterEach(async () => {
  if (actors.length) await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
  if (productIds.length) await db.delete(products).where(inArray(products.id, productIds));
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  productIds.length = 0;
});
async function actor(role = "user") {
  const suffix = randomUUID().replaceAll("-", "");
  const row = await userRepository.create({
    id: `usr_report_${suffix}`,
    username: `report_${suffix}`,
    email: `report_${suffix}@nexus.test`,
    displayName: "Reporter",
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
  const author = await actor(),
    reporter = await actor(),
    moderator = await actor("moderator");
  const [publication] = await db
    .insert(content)
    .values({
      id: id("cnt"),
      slug: id("post"),
      title: "Publication",
      body: "Body",
      authorId: author.id,
    })
    .returning();
  const [comment] = await db
    .insert(comments)
    .values({
      id: id("cmt"),
      contentId: publication.id,
      authorId: author.id,
      text: "Original text",
    })
    .returning();
  await db.update(content).set({ commentCount: 1 }).where(eq(content.id, publication.id));
  return { author, reporter, moderator, publication, comment };
}
function submission(f: Awaited<ReturnType<typeof fixture>>) {
  return {
    actorId: f.reporter.id,
    id: id("rpt"),
    auditId: id("aud"),
    targetType: "comment" as const,
    targetId: f.comment.id,
    type: "abuse",
    reason: "Abusive comment details",
    evidenceUrls: [],
  };
}
function decision(f: Awaited<ReturnType<typeof fixture>>, reportId: string) {
  return {
    id: reportId,
    actorId: f.moderator.id,
    currentToken: f.moderator.currentToken,
    expectedStatus: "open" as const,
    action: "remove_comment" as const,
    notes: "Spam removed",
    expectedRevision: discussionRevision(f.comment.id, f.comment.text),
    auditId: id("aud"),
    removalAuditId: id("aud"),
  };
}
it("serializes concurrent submissions and returns the existing under-review report", async () => {
  const f = await fixture();
  const results = await Promise.all([
    repository.submit(submission(f)),
    repository.submit(submission(f)),
  ]);
  expect(results.filter((result) => result.created)).toHaveLength(1);
  expect(results[0].id).toBe(results[1].id);
  await repository.decide({
    ...decision(f, results[0].id),
    action: "review",
    expectedRevision: undefined,
  });
  expect(await repository.submit(submission(f))).toEqual({ id: results[0].id, created: false });
  expect(await db.select().from(reports).where(eq(reports.reporterId, f.reporter.id))).toHaveLength(
    1,
  );
});
it("rejects private targets and own complaints without persisting reports", async () => {
  const f = await fixture();
  await expect(repository.submit({ ...submission(f), actorId: f.author.id })).rejects.toMatchObject(
    { code: "REPORT_OWN_TARGET" },
  );
  await db.update(content).set({ status: "draft" }).where(eq(content.id, f.publication.id));
  await expect(repository.submit(submission(f))).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(await db.select().from(reports).where(eq(reports.reporterId, f.reporter.id))).toHaveLength(
    0,
  );
});
it("keeps staff notes and unpublished target text out of reporter reads and denies other reporters", async () => {
  const f = await fixture(),
    report = await repository.submit(submission(f));
  await repository.decide({
    ...decision(f, report.id),
    action: "review",
    expectedRevision: undefined,
    notes: "Staff private notes",
  });
  await db.update(content).set({ status: "archived" }).where(eq(content.id, f.publication.id));
  const detail = await repository.detail({ actorId: f.reporter.id, staff: false }, report.id);
  expect(detail.target).toBeNull();
  expect(detail).not.toHaveProperty("moderatorNotes");
  await expect(
    repository.detail({ actorId: f.author.id, staff: false }, report.id),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(
    (await repository.detail({ actorId: f.moderator.id, staff: true }, report.id)).target?.text,
  ).toBe("Original text");
});
it("removes only the parent, retains replies and atomically resolves/audits without changing publication revision", async () => {
  const f = await fixture(),
    report = await repository.submit(submission(f));
  const [reply] = await db
    .insert(comments)
    .values({
      id: id("cmt"),
      contentId: f.publication.id,
      parentId: f.comment.id,
      authorId: f.reporter.id,
      text: "Reply remains",
    })
    .returning();
  await db
    .update(content)
    .set({ commentCount: sql`${content.commentCount} + 1` })
    .where(eq(content.id, f.publication.id));
  await repository.decide(decision(f, report.id));
  expect(await db.select().from(comments).where(eq(comments.id, f.comment.id))).toHaveLength(0);
  expect(await db.select().from(comments).where(eq(comments.id, reply.id))).toHaveLength(1);
  const [publication] = await db.select().from(content).where(eq(content.id, f.publication.id));
  expect(publication.commentCount).toBe(1);
  expect(publication.updatedAt).toEqual(f.publication.updatedAt);
  const [stored] = await db.select().from(reports).where(eq(reports.id, report.id));
  expect(stored.status).toBe("resolved");
  expect(stored.resolvedAt).not.toBeNull();
  const audits = await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.moderator.id));
  expect(audits).toHaveLength(2);
  expect(JSON.stringify(audits)).not.toContain("Original text");
  expect(
    (
      await repository.page({ actorId: f.reporter.id, staff: false }, { page: 1, view: "history" })
    ).items.map((row) => row.id),
  ).toContain(report.id);
});
it("allows only one concurrent outcome and refuses removal of a changed comment", async () => {
  const f = await fixture(),
    report = await repository.submit(submission(f));
  await db.update(comments).set({ text: "Edited text" }).where(eq(comments.id, f.comment.id));
  await expect(repository.decide(decision(f, report.id))).rejects.toMatchObject({
    code: "COMMENT_CHANGED",
  });
  const results = await Promise.allSettled(
    (["resolve", "dismiss"] as const).map((action) =>
      repository.decide({ ...decision(f, report.id), action, expectedRevision: undefined }),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "REPORT_STATE_CHANGED" },
  });
});
it("denies revoked roles and rolls back target/counter/report when either audit fails", async () => {
  const f = await fixture(),
    report = await repository.submit(submission(f));
  await db.update(users).set({ role: "user" }).where(eq(users.id, f.moderator.id));
  await expect(repository.decide(decision(f, report.id))).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await db.update(users).set({ role: "moderator" }).where(eq(users.id, f.moderator.id));
  for (const field of ["auditId", "removalAuditId"] as const) {
    const duplicateId = id("aud");
    await db.insert(auditEvents).values({
      id: duplicateId,
      actorId: f.moderator.id,
      actorType: "admin",
      action: "fixture",
      targetType: "report",
      targetId: report.id,
    });
    await expect(
      repository.decide({ ...decision(f, report.id), [field]: duplicateId }),
    ).rejects.toThrow();
    expect(await db.select().from(comments).where(eq(comments.id, f.comment.id))).toHaveLength(1);
    const [stored] = await db.select().from(reports).where(eq(reports.id, report.id));
    expect(stored.status).toBe("open");
    const [publication] = await db.select().from(content).where(eq(content.id, f.publication.id));
    expect(publication.commentCount).toBe(1);
  }
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.actorId, f.moderator.id),
          eq(auditEvents.action, "content.comment_removed"),
        ),
      ),
  ).toHaveLength(0);
});
it("excludes commercial review comments from submission, community queues and removal", async () => {
  const f = await fixture(),
    productId = id("prd"),
    reviewId = id("cmt");
  productIds.push(productId);
  await db.insert(products).values({
    id: productId,
    title: "Resource",
    slug: id("resource"),
    description: "Fixture",
    type: "script",
    authorId: f.author.id,
  });
  // comments_review_target_check: product_id requires a review-shaped row
  // (content_id/parent_id null, rating when published) — never stamp onto a content comment.
  const [review] = await db
    .insert(comments)
    .values({
      id: reviewId,
      productId,
      authorId: f.author.id,
      text: "Commercial review",
      rating: 5,
    })
    .returning();
  const reviewFixture = { ...f, comment: review };
  await expect(repository.submit(submission(reviewFixture))).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  const reportId = id("rpt");
  await db.insert(reports).values({
    id: reportId,
    reporterId: f.reporter.id,
    targetType: "comment",
    targetId: review.id,
    type: "abuse",
    reason: "Legacy commercial report",
  });
  expect(
    (await repository.page({ actorId: f.moderator.id, staff: true }, { view: "pending", page: 1 }))
      .items,
  ).toHaveLength(0);
  await expect(repository.decide(decision(reviewFixture, reportId))).rejects.toMatchObject({
    code: "REPORT_TARGET_UNAVAILABLE",
  });
  expect(await db.select().from(comments).where(eq(comments.id, review.id))).toHaveLength(1);
});
