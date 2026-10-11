import {
  commercialFeeEstimate,
  effectiveSubscriptionStatus,
  readSubscriptionSnapshot,
} from "@nexus/domain";
import { subscriptionCommandSchema } from "@nexus/validation";
import { expect, it } from "vitest";
import {
  confirmedSubscriptionEstimate,
  confirmedSubscriptionReceipt,
} from "../apps/web/src/lib/subscription-confirmation";
import { subscriptionError, subscriptionsCopy } from "../apps/web/src/lib/subscriptions-i18n";
import {
  subscriptionActivationQuery,
  subscriptionEstimateQuery,
  subscriptionId,
  subscriptionPageParams,
  subscriptionsQuery,
} from "../apps/web/src/lib/subscriptions-query";
import {
  activation,
  cancellation,
  cancelledAt,
  date,
  expiresAt,
  receipt,
  snapshot,
  subscription,
  terms,
} from "./subscriptions-fixtures";

it("refuses caller-selected terms, actor, status, dates and financial evidence", () => {
  expect(subscriptionCommandSchema.parse(activation)).toEqual(activation);
  expect(subscriptionCommandSchema.parse(cancellation)).toEqual(cancellation);
  for (const key of [
    "actorId",
    "subjectId",
    "terms",
    "expiresAt",
    "status",
    "price",
    "providerTransactionId",
  ])
    expect(subscriptionCommandSchema.safeParse({ ...activation, [key]: "bad" }).success).toBe(
      false,
    );
});
it.each([
  { planId: "../../private" },
  { expectedRevision: 0 },
  { organizationId: "org_a\n" },
  { requestId: "bad" },
  { expectedRevision: 1.5 },
])("refuses malformed activation %j", (fields) =>
  expect(subscriptionCommandSchema.safeParse({ ...activation, ...fields }).success).toBe(false),
);
it("expires exactly at the end of the term without a maintenance job", () => {
  expect(effectiveSubscriptionStatus("active", expiresAt, new Date(expiresAt.getTime() - 1))).toBe(
    "active",
  );
  expect(effectiveSubscriptionStatus("active", expiresAt, expiresAt)).toBe("expired");
  expect(effectiveSubscriptionStatus("cancelled", expiresAt, date)).toBe("cancelled");
  expect(effectiveSubscriptionStatus("paid", expiresAt, date)).toBeNull();
});
it("reads only documented zero-price terms and rejects malformed or contradictory snapshots", () => {
  expect(
    readSubscriptionSnapshot({
      ...snapshot(),
      privateToken: "secret",
      terms: { ...terms, privateToken: "secret" },
    }),
  ).toEqual(subscription);
  for (const value of [
    null,
    {},
    { ...snapshot(), terms: { ...terms, price: 1 } },
    { ...snapshot(), expiresAt: date.toISOString() },
    { ...snapshot(), status: "cancelled", cancelledAt: null },
    { ...snapshot(), cancelledAt: cancelledAt.toISOString() },
    { ...snapshot(), subjectId: "usr_a\n" },
  ])
    expect(readSubscriptionSnapshot(value)).toBeNull();
});
it("requires exact account, version, action and frozen terms before client success", () => {
  const body = JSON.parse(JSON.stringify({ receipt, replayed: false })),
    expected = { terms, planId: activation.planId, planRevision: 2 };
  expect(confirmedSubscriptionReceipt(body, activation, "usr_a", expected)).toBe(receipt.id);
  for (const invalid of [
    null,
    {},
    { ...body, replayed: undefined },
    { ...body, receipt: { ...body.receipt, action: "cancel" } },
    {
      ...body,
      receipt: {
        ...body.receipt,
        subscription: { ...body.receipt.subscription, subjectId: "other" },
      },
    },
    {
      ...body,
      receipt: {
        ...body.receipt,
        subscription: { ...body.receipt.subscription, terms: { ...terms, commissionBps: 0 } },
      },
    },
  ])
    expect(confirmedSubscriptionReceipt(invalid, activation, "usr_a", expected)).toBeNull();
});
it("confirms cancellation only for the originally viewed period", () => {
  const ended = { ...subscription, status: "cancelled", cancelledAt },
    body = JSON.parse(
      JSON.stringify({
        receipt: { ...receipt, action: "cancel", subscription: ended },
        replayed: true,
      }),
    );
  const expected = {
    terms,
    planId: subscription.planId,
    planRevision: subscription.planRevision,
    startedAt: date.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  expect(confirmedSubscriptionReceipt(body, cancellation, "usr_a", expected)).toBe(receipt.id);
  expect(
    confirmedSubscriptionReceipt(body, cancellation, "usr_a", {
      ...expected,
      expiresAt: date.toISOString(),
    }),
  ).toBeNull();
});
it("confirms fee estimates against account and exact integer economics", () => {
  const body = {
    scope: { id: "user:usr_a" },
    observedAt: date.toISOString(),
    subscriptionId: subscription.id,
    estimate: commercialFeeEstimate(10000, "USD", 750),
  };
  expect(confirmedSubscriptionEstimate(body, 10000, "USD", "user:usr_a")).toEqual(body.estimate);
  expect(confirmedSubscriptionEstimate(body, 10000, "USD", "org:org_a")).toBeNull();
  expect(
    confirmedSubscriptionEstimate(
      { ...body, estimate: { ...body.estimate, platformFee: 751 } },
      10000,
      "USD",
      "user:usr_a",
    ),
  ).toBeNull();
});
it("strictly bounds account, activation, history and estimate queries", () => {
  expect(
    subscriptionActivationQuery(new URLSearchParams("planId=cplan_free&revision=2")),
  ).toMatchObject({ planId: "cplan_free", revision: 2 });
  expect(subscriptionEstimateQuery(new URLSearchParams("amount=10000&currency=USD"))).toMatchObject(
    { amount: 10000, currency: "USD" },
  );
  for (const value of [
    "organizationId=a&organizationId=b",
    "actorId=other",
    "days=30",
    "scopePage=0",
  ])
    expect(() => subscriptionsQuery(new URLSearchParams(value))).toThrow();
  for (const value of [
    "amount=-1&currency=USD",
    "amount=100000001&currency=USD",
    "amount=1.1&currency=USD",
    "amount=1&currency=XXX",
  ])
    expect(() => subscriptionEstimateQuery(new URLSearchParams(value))).toThrow();
  expect(() => subscriptionsQuery(new URLSearchParams("page=1"), "empty")).toThrow();
  expect(() => subscriptionsQuery(new URLSearchParams("days=31"), "history")).toThrow();
  expect(() => subscriptionPageParams({ organizationId: ["a", "b"] })).toThrow();
  expect(() => subscriptionId("ok\n")).toThrow();
});
it("provides independent RU/EN lifecycle and recovery copy", () => {
  for (const locale of ["ru", "en"] as const) {
    const c = subscriptionsCopy(locale);
    expect(c.notice.length).toBeGreaterThan(200);
    for (const code of [
      "SUBSCRIPTION_INVALID",
      "SUBSCRIPTION_PLAN_CHANGED",
      "SUBSCRIPTION_ALREADY_ACTIVE",
      "SUBSCRIPTION_PAYMENT_REQUIRED",
      "SUBSCRIPTION_REQUEST_CONFLICT",
      "SUBSCRIPTION_STATE_CHANGED",
      "SUBSCRIPTION_LIMIT",
      "NOT_FOUND",
      "UNAUTHORIZED",
      "RATE_LIMIT_EXCEEDED",
    ])
      expect(subscriptionError(locale, code)).not.toBe(c.retry);
  }
});
