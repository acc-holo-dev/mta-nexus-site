import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { db, userRepository, orderCasesRepository as repo } from "@nexus/db";
import {
  auditEvents,
  commerceOrderCases,
  notifications,
  orders,
  payments,
  supportCases,
  supportCaseMessages,
} from "../packages/db/src/schema";

// Requires disposable PostgreSQL migrated through 0052. The completed payment
// below is a recorded fixture only; no provider or financial executor is called.
async function fixture() {
  const suffix = randomBytes(6).toString("hex"),
    buyerId = `usr_oc_${suffix}`,
    staffId = `usr_os_${suffix}`,
    orderId = `ord_oc_${suffix}`;
  for (const [id, role] of [
    [buyerId, "user"],
    [staffId, "admin"],
  ] as const)
    await userRepository.create({
      id,
      role,
      email: `${id}@example.invalid`,
      username: id,
      displayName: "Order support fixture",
    });
  await db.insert(orders).values({
    id: orderId,
    orderNumber: `case-${suffix}`,
    buyerId,
    status: "completed",
    totalAmount: 1200,
    currency: "USD",
  });
  await db.insert(payments).values({
    id: `pay_oc_${suffix}`,
    orderId,
    status: "completed",
    amount: 1200,
    currency: "USD",
    provider: "recorded-fixture",
    providerTransactionId: "must-not-be-projected",
  });
  const input = {
    orderId,
    actorId: buyerId,
    caseId: `sup_${randomBytes(12).toString("hex")}`,
    messageId: `spm_${suffix}`,
    auditId: `aud_oc_${suffix}`,
    command: {
      requestId: randomUUID(),
      kind: "refund_request" as const,
      subject: "Review purchase refund request",
      message: "Please investigate the recorded purchase.",
      requestedAmount: 600,
    },
  };
  await repo.create(input);
  return { suffix, buyerId, staffId, orderId, input };
}
async function reviewInput(
  f: Awaited<ReturnType<typeof fixture>>,
  action: "start_review" | "recommend_refund" | "resolve" = "start_review",
) {
  const detail = await repo.detail(f.input.caseId, f.staffId, true);
  return {
    caseId: f.input.caseId,
    actorId: f.staffId,
    auditId: `aud_r_${randomBytes(8).toString("hex")}`,
    statusAuditId: `aud_s_${randomBytes(8).toString("hex")}`,
    messageId: `spm_r_${randomBytes(8).toString("hex")}`,
    command: {
      action,
      expectedRevision: detail.case.revision,
      expectedSupportUpdatedAt: detail.case.supportUpdatedAt.toISOString(),
      expectedEvidenceHash: detail.evidenceHash,
      notes: "Review of recorded financial evidence only",
    },
  };
}
it("replays intake without duplicate context or messages, and rejects a second request for the same order", async () => {
  const f = await fixture();
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      repo.create({
        ...f.input,
        caseId: `sup_${randomBytes(12).toString("hex")}`,
        auditId: `aud_${randomBytes(10).toString("hex")}`,
      }),
    ),
  );
  expect(results.every((result) => result.caseId === f.input.caseId && result.replayed)).toBe(true);
  await expect(
    repo.create({ ...f.input, command: { ...f.input.command, requestId: randomUUID() } }),
  ).rejects.toMatchObject({ code: "ORDER_CASE_EXISTS" });
  expect(
    (
      await db
        .select({ total: count() })
        .from(supportCaseMessages)
        .where(eq(supportCaseMessages.caseId, f.input.caseId))
    )[0]?.total,
  ).toBe(1);
});
it("commits one competing review and rejects the stale reviewer", async () => {
  const f = await fixture(),
    input = await reviewInput(f);
  const results = await Promise.allSettled([
    repo.review(input),
    repo.review({
      ...input,
      auditId: `${input.auditId}_other`,
      statusAuditId: `${input.statusAuditId}_other`,
      messageId: `${input.messageId}_other`,
    }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(
    (results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason,
  ).toMatchObject({ code: "ORDER_CASE_REVISION_CONFLICT" });
  expect((await repo.detail(f.input.caseId, f.buyerId)).case.revision).toBe(2);
});
it("records a recommendation and notification without changing the order or recorded capture", async () => {
  const f = await fixture();
  await repo.review(await reviewInput(f));
  const beforeOrder = await db.select().from(orders).where(eq(orders.id, f.orderId)),
    beforePayments = await db.select().from(payments).where(eq(payments.orderId, f.orderId));
  const input = await reviewInput(f, "recommend_refund");
  expect(await repo.review(input)).toMatchObject({
    financialExecution: false,
    reviewStatus: "refund_recommended",
    threadStatus: "open",
  });
  expect(await db.select().from(orders).where(eq(orders.id, f.orderId))).toEqual(beforeOrder);
  expect(await db.select().from(payments).where(eq(payments.orderId, f.orderId))).toEqual(
    beforePayments,
  );
  const detail = await repo.detail(f.input.caseId, f.buyerId);
  expect(JSON.stringify(detail)).not.toContain("must-not-be-projected");
  expect(JSON.stringify(detail)).not.toContain("recorded-fixture");
  expect(
    (await db.select().from(notifications).where(eq(notifications.recipientId, f.buyerId))).length,
  ).toBeGreaterThan(0);
});
it("rejects SQL reassociation and immutable intake changes", async () => {
  const f = await fixture();
  await expect(
    db
      .update(commerceOrderCases)
      .set({ requestedAmount: 500 })
      .where(eq(commerceOrderCases.caseId, f.input.caseId)),
  ).rejects.toThrow();
  await expect(
    db
      .update(supportCases)
      .set({ requesterId: f.staffId })
      .where(eq(supportCases.id, f.input.caseId)),
  ).rejects.toThrow();
  await db
    .update(commerceOrderCases)
    .set({ revision: 99 })
    .where(eq(commerceOrderCases.caseId, f.input.caseId));
  expect((await repo.detail(f.input.caseId, f.buyerId)).case.revision).toBe(1);
  await expect(repo.detail(f.input.caseId, f.staffId, false)).rejects.toMatchObject({
    statusCode: 404,
  });
});
it("rolls review, shared status, message and notification back when auditing fails", async () => {
  const f = await fixture(),
    input = await reviewInput(f);
  await db.insert(auditEvents).values({
    id: input.auditId,
    actorId: f.staffId,
    actorType: "admin",
    action: "fixture",
    targetType: "support_case",
    targetId: f.input.caseId,
  });
  const before = await repo.detail(f.input.caseId, f.buyerId);
  await expect(repo.review(input)).rejects.toThrow();
  const after = await repo.detail(f.input.caseId, f.buyerId);
  expect(after.case).toEqual(before.case);
  expect(
    (
      await db
        .select({ total: count() })
        .from(supportCaseMessages)
        .where(eq(supportCaseMessages.caseId, f.input.caseId))
    )[0]?.total,
  ).toBe(1);
  expect(
    await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientId, f.buyerId))),
  ).toHaveLength(0);
});
