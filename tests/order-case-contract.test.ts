import { expect, it } from "vitest";
import { orderCaseCreateSchema, orderCaseReviewSchema } from "@nexus/validation";
import { orderCaseQuery, orderCasePageQuery } from "../apps/web/src/lib/order-case-query";
import {
  confirmOrderCaseCreated,
  confirmOrderCaseReviewed,
  parseOrderCaseAmount,
} from "../apps/web/src/lib/order-case-response";
const requestId = "00000000-0000-4000-8000-000000000000",
  caseId = `sup_${"a".repeat(24)}`;
const draft = {
  requestId,
  kind: "refund_request",
  subject: " Refund request ",
  message: " Please investigate this purchase. ",
  requestedAmount: 1200,
};
it("normalizes intake without trusting financial or requester fields", () => {
  expect(orderCaseCreateSchema.parse(draft).subject).toBe("Refund request");
  for (const extra of [{ buyerId: "usr_b" }, { status: "refunded" }, { snapshot: {} }])
    expect(orderCaseCreateSchema.safeParse({ ...draft, ...extra }).success).toBe(false);
});
it.each([
  { ...draft, requestedAmount: null },
  { ...draft, requestedAmount: 0 },
  { ...draft, requestedAmount: 1.5 },
  { ...draft, kind: "payment_issue" },
  { ...draft, requestId: "not-an-id" },
  { ...draft, message: "short" },
])("rejects invalid intake amounts and identities", (value) =>
  expect(orderCaseCreateSchema.safeParse(value).success).toBe(false),
);
it("allows amount-free disputes and non-financial issues", () => {
  for (const kind of ["dispute", "payment_issue", "resource_issue"])
    expect(orderCaseCreateSchema.safeParse({ ...draft, kind, requestedAmount: null }).success).toBe(
      true,
    );
});
it.each([
  ["12.34", 1234],
  ["12,3", 1230],
  ["0.01", 1],
  ["", null],
  ["0", undefined],
  ["-1", undefined],
  ["1e2", undefined],
  ["1.001", undefined],
  ["12.35", undefined],
  ["21474836.48", undefined],
])("parses minor-unit money without rounding %s", (input, expected) =>
  expect(parseOrderCaseAmount(input as string, 1234)).toBe(expected),
);
it.each([
  "page=0",
  "page=01",
  "page=10000",
  "page=1&page=2",
  "buyerId=usr_b",
  "reviewStatus=refunded",
  "threadStatus=open&threadStatus=closed",
])("rejects ambiguous or unsafe filters %s", (query) =>
  expect(() => orderCaseQuery(new URLSearchParams(query), true)).toThrow(),
);
it("accepts bounded filters and rejects duplicate page arrays", () => {
  expect(
    orderCasePageQuery(
      { reviewStatus: "refund_recommended", threadStatus: "open", page: "9999" },
      true,
    ),
  ).toEqual({ page: 9999, reviewStatus: "refund_recommended", threadStatus: "open" });
  expect(() => orderCasePageQuery({ page: ["1", "2"] })).toThrow();
});
const review = {
  action: "recommend_refund" as const,
  expectedRevision: 2,
  expectedSupportUpdatedAt: "2026-10-11T00:00:00.000Z",
  expectedEvidenceHash: "a".repeat(64),
  notes: "Recorded evidence reviewed",
};
it("requires every observed revision and canonical timestamp", () => {
  expect(orderCaseReviewSchema.safeParse(review).success).toBe(true);
  for (const extra of [
    { expectedRevision: 0 },
    { expectedSupportUpdatedAt: "2026-10-11T00:00:00Z" },
    { expectedEvidenceHash: "x" },
    { financialExecution: true },
  ])
    expect(orderCaseReviewSchema.safeParse({ ...review, ...extra }).success).toBe(false);
});
it("confirms only the exact persisted creation receipt", () => {
  const receipt = {
    kind: "order_case_created",
    orderId: "ord_a",
    requestId,
    caseId,
    replayed: true,
  };
  expect(confirmOrderCaseCreated(receipt, "ord_a", requestId)).toBe(caseId);
  for (const extra of [
    { orderId: "ord_b" },
    { requestId: "different" },
    { caseId: "/evil" },
    { replayed: undefined },
    { kind: "refund_completed" },
  ])
    expect(confirmOrderCaseCreated({ ...receipt, ...extra }, "ord_a", requestId)).toBeNull();
});
it("cannot confirm a money-moving, mismatched or stale review receipt", () => {
  const receipt = {
    kind: "order_case_reviewed",
    caseId,
    action: review.action,
    reviewStatus: "refund_recommended",
    revision: 3,
    threadStatus: "open",
    supportUpdatedAt: "2026-10-11T00:00:00.001Z",
    financialExecution: false,
  };
  expect(confirmOrderCaseReviewed(receipt, caseId, review, "reviewing")).toBe(true);
  for (const extra of [
    { financialExecution: true },
    { financialExecution: undefined },
    { threadStatus: "resolved" },
    { revision: 2 },
    { supportUpdatedAt: review.expectedSupportUpdatedAt },
    { caseId: "sup_other" },
  ])
    expect(confirmOrderCaseReviewed({ ...receipt, ...extra }, caseId, review, "reviewing")).toBe(
      false,
    );
});
