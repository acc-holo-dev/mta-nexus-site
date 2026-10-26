import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  db,
  products,
  builds,
  comments,
  entitlements,
  users,
  reports,
  auditEvents,
  resourceReviewsRepository as repo,
  reportRepository,
  sessionRepository,
} from "@nexus/db";

it("persists review revisions, grant expiry, live moderation, atomic rollback and aggregate integrity", async () => {
  const suffix = randomUUID().replaceAll("-", ""),
    id = (prefix: string) => `${prefix}_${suffix}`;
  const buyer = id("usr_buyer"),
    reporter = id("usr_reporter"),
    publisher = id("usr_publisher"),
    staff = id("usr_staff"),
    productId = id("prd");
  const actors = [buyer, reporter, publisher, staff];
  try {
    await db
      .insert(users)
      .values(
        actors.map((actor) => ({
          id: actor,
          email: `${actor}@nexus.test`,
          username: actor,
          displayName: actor,
          role: actor === staff ? "moderator" : actor === publisher ? "developer" : "user",
        })),
      );
    await sessionRepository.create({
      id: `ses_${staff}`,
      userId: staff,
      token: `tok_${staff}`,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    await db
      .insert(products)
      .values({
        id: productId,
        title: "Review lifecycle fixture",
        slug: id("review"),
        description: "Private integration fixture",
        type: "script",
        authorId: publisher,
        status: "published",
        price: 0,
        currency: "USD",
        licenseModel: "unlimited",
      });
    await db
      .insert(builds)
      .values({
        id: id("bld"),
        productId,
        version: "1.0.0",
        storageKey: "fixtures/review.zip",
        sha256Hash: "a".repeat(64),
        fileSizeBytes: 100,
        status: "published",
        scanStatus: "clean",
        scanner: "integration-fixture",
        scannedAt: new Date(),
      });
    const command = (
      actorId: string,
      expectedRevision: number,
      rating = 5,
      auditId = `aud_${randomUUID()}`,
    ) =>
      repo.command({
        actorId,
        productId,
        reviewId: `cmt_${randomUUID()}`,
        auditId,
        command: { action: "save", expectedRevision, rating, text: "Useful resource review" },
      });
    const [before] = await db
      .select({ updatedAt: products.updatedAt })
      .from(products)
      .where(eq(products.id, productId));
    await expect(command(buyer, 0)).rejects.toMatchObject({ code: "REVIEW_ACCESS_REQUIRED" });
    await db
      .insert(entitlements)
      .values(
        [buyer, publisher].map((actor, i) => ({
          id: id(`ent_${i}`),
          subjectType: "user",
          subjectId: actor,
          permission: "product.download",
          resourceId: productId,
        })),
      );
    await expect(command(publisher, 0)).rejects.toMatchObject({ code: "REVIEW_ACCESS_REQUIRED" });
    const first = await command(buyer, 0, 5, id("aud_initial"));
    expect(first).toMatchObject({ revision: 1, ratingCount: 1, ratingAverage: 50 });
    const concurrent = await Promise.allSettled([command(buyer, 1, 3), command(buyer, 1, 4)]);
    expect(concurrent.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    const refused = concurrent.find((row) => row.status === "rejected");
    expect(refused?.status === "rejected" ? refused.reason : null).toMatchObject({
      code: "REVIEW_CHANGED",
    });
    const [current] = await db.select().from(comments).where(eq(comments.id, first.id));
    const [rating] = await db
      .select({
        count: products.ratingCount,
        average: products.ratingAverage,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(eq(products.id, productId));
    expect(current.reviewRevision).toBe(2);
    expect(rating.count).toBe(1);
    expect(rating.average).toBe((current.rating ?? 0) * 10);
    expect(rating.updatedAt).toEqual(before.updatedAt);
    // A failing audit must roll back both the text revision and rating update.
    await expect(command(buyer, 2, 1, id("aud_initial"))).rejects.toThrow();
    const [afterFailure] = await db.select().from(comments).where(eq(comments.id, first.id));
    expect(afterFailure).toEqual(current);
    await db
      .update(entitlements)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(eq(entitlements.resourceId, productId), eq(entitlements.subjectId, buyer)));
    await expect(command(buyer, 2)).rejects.toMatchObject({ code: "REVIEW_ACCESS_REQUIRED" });
    expect(
      await repo.command({
        actorId: buyer,
        productId,
        reviewId: first.id,
        auditId: id("aud_withdraw"),
        command: { action: "withdraw", expectedRevision: 2 },
      }),
    ).toMatchObject({ revision: 3, status: "withdrawn", ratingCount: 0 });
    await db
      .update(entitlements)
      .set({ expiresAt: null })
      .where(and(eq(entitlements.resourceId, productId), eq(entitlements.subjectId, buyer)));
    await command(buyer, 3);
    const reportInput = {
      actorId: reporter,
      productId,
      reviewId: first.id,
      id: id("rpt"),
      auditId: id("aud_report"),
      type: "spam",
      reason: "Repeated spam in the review",
    };
    expect(await repo.report(reportInput)).toEqual({ id: id("rpt"), created: true });
    expect(
      await repo.report({ ...reportInput, id: id("rpt_duplicate"), auditId: id("aud_duplicate") }),
    ).toEqual({ id: id("rpt"), created: false });
    // Generic report resolution cannot bypass the commercial evidence contract.
    expect(
      await reportRepository.resolve(id("rpt"), "resolved", "Bypass attempt", {
        id: id("aud_bypass"),
        actorId: staff,
        actorType: "admin",
        action: "report.resolved",
        targetId: id("rpt"),
        targetType: "report",
      }, `tok_${staff}`),
    ).toBeNull();
    const decide = (expectedRevision: number) =>
      repo.decide({
        actorId: staff,
        id: id("rpt"),
        auditId: `aud_${randomUUID()}`,
        command: {
          action: "remove_review",
          expectedStatus: "open",
          expectedRevision,
          notes: "Review contains repeated spam",
        },
      });
    await db.update(users).set({ role: "user" }).where(eq(users.id, staff));
    await expect(decide(4)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(users).set({ role: "moderator" }).where(eq(users.id, staff));
    await expect(decide(3)).rejects.toMatchObject({ code: "REVIEW_CHANGED" });
    expect(await decide(4)).toMatchObject({ status: "resolved", reviewRemoved: true });
    expect((await repo.publicPage(productId)).reviews).toHaveLength(0);
    expect((await repo.ownDetail(buyer, productId)).canReview).toBe(false);
    await expect(command(buyer, 5)).rejects.toMatchObject({ code: "REVIEW_MODERATED" });
    const detail = await repo.reportDetail({ actorId: reporter, staff: false }, id("rpt"));
    expect(detail.review).toBeNull();
    expect(detail).not.toHaveProperty("moderatorNotes");
    await expect(
      repo.reportDetail({ actorId: publisher, staff: false }, id("rpt")),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  } finally {
    await db.delete(reports).where(inArray(reports.reporterId, actors));
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    await db.delete(entitlements).where(eq(entitlements.resourceId, productId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(users).where(inArray(users.id, actors));
  }
});
