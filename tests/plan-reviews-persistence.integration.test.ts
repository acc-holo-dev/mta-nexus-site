import { createHash, randomUUID } from "node:crypto";
import {
  auditEvents,
  commercialPlanReviews,
  db,
  organizationMembers,
  organizations,
  commercialPlanRepository as plans,
  planReviewsRepository as reviews,
  userRepository,
} from "@nexus/db";
import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";

// Disposable PostgreSQL through 0064 only. Immutable revisions/reviews are retained
// until the test database is discarded; no payment provider or activation is used.
async function fixture(scope: "user" | "organization" = "user") {
  const key = randomUUID().replaceAll("-", ""),
    actor = `usr_prev_${key}`,
    other = `usr_prev_other_${key}`,
    admin = `usr_prev_admin_${key}`,
    planId = `cplan_prev_${key}`,
    org = `org_prev_${key}`;
  for (const [id, role] of [
    [actor, "user"],
    [other, "user"],
    [admin, "admin"],
  ] as const)
    await userRepository.create({
      id,
      role,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
    });
  if (scope === "organization") {
    await db
      .insert(organizations)
      .values({ id: org, ownerId: other, name: "Plan fixture org", slug: org });
    await db
      .insert(organizationMembers)
      .values({ id: `member_${key}`, organizationId: org, userId: actor, role: "admin" });
  }
  const terms = {
    titleRu: "Тариф обзора",
    titleEn: "Review plan",
    descriptionRu: "Описание тарифа обзора",
    descriptionEn: "Review plan description",
    price: 900,
    currency: "USD" as const,
    durationDays: 30 as const,
    commissionBps: 750,
  };
  await plans.command({
    actorId: admin,
    planId,
    auditId: `aud_create_prev_${key}`,
    command: {
      action: "create",
      slug: `review-${key}`,
      scope,
      terms,
      reason: "Create review fixture",
    },
  });
  await plans.command({
    actorId: admin,
    planId,
    auditId: `aud_publish_prev_${key}`,
    command: { action: "publish", expectedRevision: 1, reason: "Publish review fixture" },
  });
  const command = {
    requestId: randomUUID(),
    planId,
    expectedRevision: 2,
    grossAmount: 10000,
    currency: "RUB" as const,
    ...(scope === "organization" ? { organizationId: org } : {}),
  };
  return { actor, other, admin, planId, org, terms, command, key };
}
it("concurrent exact requests commit one immutable review and one audit", async () => {
  const f = await fixture();
  const receipts = await Promise.all(
    Array.from({ length: 4 }, () => reviews.save(f.actor, f.command)),
  );
  expect(new Set(receipts.map((r) => r.review.id)).size).toBe(1);
  expect(receipts.filter((r) => !r.replayed)).toHaveLength(1);
  const id = receipts[0]?.review.id;
  if (!id) throw new Error("Missing fixture review");
  expect(
    await db.select().from(commercialPlanReviews).where(eq(commercialPlanReviews.id, id)),
  ).toHaveLength(1);
  expect(await db.select().from(auditEvents).where(eq(auditEvents.targetId, id))).toHaveLength(1);
  await expect(reviews.save(f.actor, { ...f.command, grossAmount: 10001 })).rejects.toMatchObject({
    code: "PLAN_REVIEW_CONFLICT",
  });
});
it("terms survive plan changes/withdrawal and cannot be edited or supplied by callers", async () => {
  const f = await fixture(),
    saved = await reviews.save(f.actor, f.command),
    id = saved.review.id;
  await expect(
    db
      .update(commercialPlanReviews)
      .set({ grossAmount: 1 })
      .where(eq(commercialPlanReviews.id, id)),
  ).rejects.toThrow();
  await expect(
    db.delete(commercialPlanReviews).where(eq(commercialPlanReviews.id, id)),
  ).rejects.toThrow();
  await expect(
    db.insert(commercialPlanReviews).values({
      id: `prev_forged_${f.key}`,
      actorId: f.actor,
      requestId: randomUUID(),
      subjectType: "user",
      subjectId: f.actor,
      planId: f.planId,
      planRevision: 2,
      grossAmount: 1,
      currency: "USD",
      termsSnapshot: f.terms,
    }),
  ).rejects.toThrow();
  await plans.command({
    actorId: f.admin,
    planId: f.planId,
    auditId: `aud_save_prev_${f.key}`,
    command: {
      action: "save",
      expectedRevision: 2,
      terms: { ...f.terms, price: 1000 },
      reason: "Change review fixture terms",
    },
  });
  expect((await reviews.detail(f.actor, id)).state).toBe("unavailable");
  await plans.command({
    actorId: f.admin,
    planId: f.planId,
    auditId: `aud_republish_prev_${f.key}`,
    command: { action: "publish", expectedRevision: 3, reason: "Publish changed fixture terms" },
  });
  expect(await reviews.detail(f.actor, id)).toMatchObject({
    state: "changed",
    review: { terms: { price: 900 } },
    current: { revision: 4, terms: { price: 1000 } },
  });
  expect(await reviews.save(f.actor, f.command)).toMatchObject({
    replayed: true,
    review: { terms: { price: 900 } },
  });
  await expect(
    reviews.save(f.actor, { ...f.command, requestId: randomUUID() }),
  ).rejects.toMatchObject({ code: "PLAN_REVIEW_PLAN_CHANGED" });
});
it("organization reviews are shared with current managers and revoked rights block retry/read", async () => {
  const f = await fixture("organization"),
    saved = await reviews.save(f.actor, f.command);
  expect((await reviews.detail(f.other, saved.review.id, f.org)).review.terms).toEqual(f.terms);
  await expect(reviews.detail(f.actor, saved.review.id)).rejects.toMatchObject({ statusCode: 404 });
  await db
    .update(organizationMembers)
    .set({ role: "developer" })
    .where(
      and(eq(organizationMembers.organizationId, f.org), eq(organizationMembers.userId, f.actor)),
    );
  await expect(reviews.save(f.actor, f.command)).rejects.toMatchObject({ statusCode: 404 });
  await expect(reviews.detail(f.actor, saved.review.id, f.org)).rejects.toMatchObject({
    statusCode: 404,
  });
});
it("an audit collision rolls back the new review", async () => {
  const f = await fixture(),
    id = `prev_${createHash("sha256").update(`${f.actor}:${f.command.requestId}`).digest("hex")}`;
  await db.insert(auditEvents).values({
    id: `aud_${id}`,
    actorId: f.actor,
    actorType: "user",
    action: "fixture.audit_collision",
    targetId: id,
    targetType: "commercial_plan_review",
    details: {},
  });
  await expect(reviews.save(f.actor, f.command)).rejects.toThrow();
  expect(
    await db.select().from(commercialPlanReviews).where(eq(commercialPlanReviews.id, id)),
  ).toHaveLength(0);
});
