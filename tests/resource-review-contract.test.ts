import { expect, it } from "vitest";
import {
  resourceReviewCreateSchema,
  resourceReviewCommandSchema,
  resourceReviewDecisionSchema,
  resourceReviewReportSchema,
} from "@nexus/validation";
import {
  resourceReviewQuery,
  resourceReviewPageQuery,
} from "../apps/web/src/lib/resource-review-query";
import {
  confirmedReview,
  confirmedReviewDecision,
  confirmedReviewReport,
} from "../apps/web/src/lib/resource-review-confirmation";
it.each([0, 6, 1.5, NaN, "5"])("rejects invalid rating %s", (rating) => {
  expect(resourceReviewCreateSchema.safeParse({ text: "Useful map", rating }).success).toBe(false);
});
it("requires a rating and never accepts caller acquisition evidence or ownership", () => {
  for (const body of [
    { text: "Great" },
    { text: "Great", rating: 5, authorId: "other" },
    { text: "Great", rating: 5, isVerifiedPurchase: true },
  ])
    expect(resourceReviewCreateSchema.safeParse(body).success).toBe(false);
  expect(resourceReviewCreateSchema.parse({ text: "  Great  ", rating: 5 })).toEqual({
    text: "Great",
    rating: 5,
  });
});
it("bounds text and preserves withdrawal's strict revision contract", () => {
  expect(resourceReviewCommandSchema.parse({ action: "withdraw", expectedRevision: 3 })).toEqual({
    action: "withdraw",
    expectedRevision: 3,
  });
  for (const body of [
    { action: "withdraw", expectedRevision: 0 },
    { action: "save", expectedRevision: -1, text: "Great", rating: 5 },
    { action: "save", expectedRevision: 0, text: "a".repeat(4001), rating: 5 },
    { action: "withdraw", expectedRevision: 1, text: "bypass" },
  ])
    expect(resourceReviewCommandSchema.safeParse(body).success).toBe(false);
});
it("requires exact review evidence only for removal and protects report notes", () => {
  expect(
    resourceReviewDecisionSchema.safeParse({
      action: "remove_review",
      expectedStatus: "open",
      notes: "Spam",
    }).success,
  ).toBe(false);
  expect(
    resourceReviewDecisionSchema.safeParse({
      action: "remove_review",
      expectedStatus: "open",
      notes: "Spam",
      expectedRevision: 2,
    }).success,
  ).toBe(true);
  expect(
    resourceReviewDecisionSchema.safeParse({
      action: "resolve",
      expectedStatus: "open",
      notes: "Done",
      expectedRevision: 2,
    }).success,
  ).toBe(false);
  expect(
    resourceReviewReportSchema.safeParse({
      type: "spam",
      reason: "A spam message",
      reporterId: "other",
    }).success,
  ).toBe(false);
});
it.each(["page=0", "page=01", "page=1&page=2", "page=10000", "actorId=other", "view=history"])(
  "rejects ambiguous public query %s",
  (value) => {
    expect(() => resourceReviewQuery(new URLSearchParams(value))).toThrow();
  },
);
it("preserves report filters and refuses repeated page values in page rendering", () => {
  expect(resourceReviewPageQuery({ page: "2", view: "history" }, true)).toEqual({
    page: 2,
    view: "history",
  });
  expect(() => resourceReviewPageQuery({ page: ["1", "2"] })).toThrow();
});
it("does not display success for malformed or unrelated write acknowledgements", () => {
  expect(confirmedReview({ id: "cmt_a", revision: 2, status: "published" }, 1, "save")).toBe(true);
  expect(confirmedReview({ id: "cmt_a", revision: 1, status: "published" }, 1, "save")).toBe(false);
  expect(confirmedReviewReport({ id: "rpt_a", created: false })).toBe(true);
  expect(confirmedReviewReport({ id: "rpt_a", status: "open" })).toBe(false);
  expect(
    confirmedReviewDecision(
      { id: "rpt_a", status: "resolved", reviewRemoved: true },
      "rpt_a",
      "remove_review",
    ),
  ).toBe(true);
  expect(
    confirmedReviewDecision(
      { id: "foreign", status: "resolved", reviewRemoved: true },
      "rpt_a",
      "remove_review",
    ),
  ).toBe(false);
});
