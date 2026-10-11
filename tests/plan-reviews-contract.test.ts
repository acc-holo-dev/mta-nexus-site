import { commercialFeeEstimate, readPlanReviewTerms } from "@nexus/domain";
import { planReviewCommandSchema } from "@nexus/validation";
import { expect, it } from "vitest";
import { confirmedPlanReview } from "../apps/web/src/lib/plan-review-confirmation";
import { planReviewError, planReviewsCopy } from "../apps/web/src/lib/plan-reviews-i18n";
import {
  planReviewHref,
  planReviewNewQuery,
  planReviewsQuery,
} from "../apps/web/src/lib/plan-reviews-query";

const terms = {
  titleRu: "Тариф",
  titleEn: "Plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Plan description",
  price: 900,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 750,
};
const command = {
  requestId: "11111111-1111-4111-8111-111111111111",
  planId: "cplan_a",
  expectedRevision: 2,
  grossAmount: 10000,
  currency: "RUB" as const,
};
const review = {
  id: `prev_${"a".repeat(64)}`,
  planId: command.planId,
  planRevision: 2,
  scope: "user",
  subjectId: "usr_a",
  terms,
  createdAt: "2026-10-11T00:00:00.000Z",
  estimate: commercialFeeEstimate(10000, "RUB", 750),
};
it("accepts only the documented command, without actor-selected identities or snapshots", () => {
  expect(planReviewCommandSchema.parse(command)).toEqual(command);
  for (const extra of [
    { actorId: "usr_other" },
    { subjectId: "usr_other" },
    { termsSnapshot: terms },
    { subscriptionStatus: "active" },
  ])
    expect(planReviewCommandSchema.safeParse({ ...command, ...extra }).success).toBe(false);
});
it.each([
  { grossAmount: -1 },
  { grossAmount: 1.5 },
  { grossAmount: 100_000_001 },
  { currency: "XYZ" },
  { expectedRevision: 0 },
  { planId: "../private" },
  { organizationId: "org_a\n" },
  { requestId: "not-uuid" },
])("rejects malformed command %j", (change) =>
  expect(planReviewCommandSchema.safeParse({ ...command, ...change }).success).toBe(false),
);
it("projects only documented plan fields and rejects unknown or malformed terms", () => {
  expect(readPlanReviewTerms({ ...terms, providerSecret: "SECRET" })).toEqual(terms);
  for (const value of [
    null,
    {},
    { ...terms, price: "900" },
    { ...terms, durationDays: 31 },
    { ...terms, commissionBps: 1001 },
    { ...terms, titleRu: "" },
  ])
    expect(readPlanReviewTerms(value)).toBeNull();
});
it("strictly parses history, new selections and detail scope, with stable context links", () => {
  expect(
    planReviewsQuery(new URLSearchParams("days=90&page=2&organizationId=org_a")),
  ).toMatchObject({ days: 90, page: 2, organizationId: "org_a" });
  expect(planReviewNewQuery(new URLSearchParams("planId=cplan_a&revision=2&scopePage=3"))).toEqual({
    planId: "cplan_a",
    revision: 2,
    scopePage: 3,
  });
  expect(planReviewHref(review.id, "org_a")).toContain("?organizationId=org_a");
  for (const q of [
    "actorId=other",
    "page=1&page=2",
    "page=1%0A",
    "days=31",
    "organizationId=../other",
    "pageSize=100",
  ]) {
    expect(() => planReviewsQuery(new URLSearchParams(q))).toThrow();
  }
  expect(() => planReviewsQuery(new URLSearchParams("page=2"), true)).toThrow();
  expect(() =>
    planReviewNewQuery(new URLSearchParams("planId=cplan_a&revision=2147483647")),
  ).toThrow();
});
it("confirms the exact persisted selection before navigating", () => {
  expect(confirmedPlanReview({ review }, command, "usr_a", terms)).toBe(review.id);
  for (const change of [
    { subjectId: "usr_other" },
    { planRevision: 3 },
    { scope: "organization" },
    { id: "../private" },
    { createdAt: "invalid" },
    { terms: { ...terms, price: 1 } },
    { estimate: { ...review.estimate, subscriptionActivationAvailable: true } },
    { estimate: { ...review.estimate, platformFee: 1 } },
  ])
    expect(
      confirmedPlanReview({ review: { ...review, ...change } }, command, "usr_a", terms),
    ).toBeNull();
});

it("localizes revoked access, expired sessions and rate limits without promising completion", () => {
  for (const locale of ["ru", "en"] as const) {
    const c = planReviewsCopy(locale);
    expect(planReviewError(locale, "UNAUTHORIZED")).toBe(c.signInRequired);
    expect(planReviewError(locale, "NOT_FOUND")).toBe(c.access);
    expect(planReviewError(locale, "RATE_LIMIT_EXCEEDED")).toBe(c.rate);
    expect(planReviewError(locale, "UNKNOWN_INTERNAL_ERROR")).toBe(c.retry);
  }
});
