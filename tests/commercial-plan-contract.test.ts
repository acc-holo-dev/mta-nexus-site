import { expect, it } from "vitest";
import { commercialFeeEstimate, commercialPlanTransition } from "@nexus/domain";
import {
  commercialPlanCommandSchema,
  commercialPlanTermsSchema,
  orderCancellationCommandSchema,
} from "@nexus/validation";
import {
  confirmedCommercialEstimate,
  confirmedCommercialPlan,
  confirmedOrderCancellation,
  parseCommercialAmount,
} from "../apps/web/src/lib/commercial-confirmation";
import {
  commercialAdminQuery,
  commercialCatalogQuery,
  commercialQuoteQuery,
} from "../apps/web/src/lib/commercial-plan-query";

const terms = {
  titleRu: "Тариф",
  titleEn: "Seller plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Published plan terms",
  price: 999,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 750,
};
const plan = {
  ...terms,
  id: "cplan_a",
  slug: "seller-plan",
  scope: "user" as const,
  status: "published" as const,
  revision: 2,
};
it("estimates integer fees without activating checkout, balances or subscriptions", () => {
  expect(commercialFeeEstimate(5, "USD")).toEqual({
    kind: "estimate",
    grossAmount: 5,
    currency: "USD",
    commissionBps: 1000,
    platformFee: 1,
    sellerProceeds: 4,
    initialHoldDays: 7,
    paidCheckoutAvailable: false,
    subscriptionActivationAvailable: false,
  });
  expect(commercialFeeEstimate(100_000_000, "RUB", 750).platformFee).toBe(7_500_000);
  expect(commercialFeeEstimate(999, "EUR", 0).sellerProceeds).toBe(999);
});
it.each([-1, NaN, Infinity, 1.5, 100_000_001])(
  "rejects invalid transaction amount %s",
  (amount) => {
    expect(() => commercialFeeEstimate(amount, "USD")).toThrow();
  },
);
it.each([-1, 1.5, 1001, Infinity])(
  "rejects commission outside configured benefit range %s",
  (commission) => {
    expect(() => commercialFeeEstimate(100, "USD", commission)).toThrow();
  },
);
it.each([7, 30, 90, 365])(
  "supports commercial term %s independently of resource licenses",
  (durationDays) => {
    expect(commercialPlanTermsSchema.safeParse({ ...terms, durationDays }).success).toBe(true);
  },
);
it.each([
  { durationDays: 31 },
  { commissionBps: 1001 },
  { price: 0.5 },
  { currency: "BTC" },
  { titleRu: " " },
  { privateKey: "secret" },
])("rejects malformed plan terms %j", (change) => {
  expect(commercialPlanTermsSchema.safeParse({ ...terms, ...change }).success).toBe(false);
});
it("enforces lifecycle transitions and republishes edited terms only after review", () => {
  expect(commercialPlanTransition("published", "save")).toBe("draft");
  expect(commercialPlanTransition("published", "publish")).toBeNull();
  expect(commercialPlanTransition("archived", "save")).toBeNull();
  expect(commercialPlanTransition("archived", "restore")).toBe("draft");
  expect(commercialPlanTransition("draft", "publish")).toBe("published");
});
it("confirms only the exact terms, state, identity and next version", () => {
  const command = commercialPlanCommandSchema.parse({
    action: "save",
    expectedRevision: 2,
    terms: { ...terms, price: 2000 },
    reason: "Price changed",
  });
  const confirmed = { plan: { ...plan, status: "draft", revision: 3, price: 2000 } };
  expect(confirmedCommercialPlan(confirmed, command, plan)).toEqual({ id: "cplan_a" });
  for (const change of [
    { revision: 4 },
    { status: "published" },
    { id: "cplan_other" },
    { scope: "organization" },
    { price: 999 },
  ])
    expect(
      confirmedCommercialPlan({ plan: { ...confirmed.plan, ...change } }, command, plan),
    ).toBeNull();
});
it("does not accept a fabricated activation or mismatched quote", () => {
  const quote = { ...commercialFeeEstimate(999, "USD", 750), plan: { id: plan.id, revision: 2 } };
  expect(confirmedCommercialEstimate(quote, 999, "USD", plan)).toBeTruthy();
  for (const change of [
    { subscriptionActivationAvailable: true },
    { platformFee: 0 },
    { sellerProceeds: 999 },
    { initialHoldDays: 0 },
    { plan: { id: plan.id, revision: 3 } },
  ])
    expect(confirmedCommercialEstimate({ ...quote, ...change }, 999, "USD", plan)).toBeNull();
});
it.each(["-1", "1e2", "01.00", "1.001", "1000000.01", "Infinity", ""])(
  "rejects ambiguous amount input %s",
  (value) => {
    expect(parseCommercialAmount(value)).toBeNull();
  },
);
it("parses localized decimal amounts without floating point multiplication", () => {
  expect(parseCommercialAmount("19,99")).toBe(1999);
  expect(parseCommercialAmount("0.05")).toBe(5);
  expect(parseCommercialAmount("1000000")).toBe(100_000_000);
});
it.each([
  "amount=100&currency=USD&revision=2",
  "amount=100&currency=USD&planId=cplan_a",
  "amount=100&currency=USD&amount=200",
  "amount=01&currency=USD",
  "amount=1&currency=BTC",
  "amount=100&currency=USD&buyerId=other",
])("rejects ambiguous quote parameters %s", (query) => {
  expect(() => commercialQuoteQuery(new URLSearchParams(query))).toThrow();
});
it("validates bounded, scoped catalog and admin query contracts", () => {
  expect(commercialCatalogQuery(new URLSearchParams("scope=organization&page=2"))).toEqual({
    scope: "organization",
    page: 2,
  });
  expect(() => commercialAdminQuery(new URLSearchParams("status=active"))).toThrow();
  expect(() => commercialCatalogQuery(new URLSearchParams("page=1001"))).toThrow();
});
it("requires a durable UUID and canonical millisecond order revision", () => {
  const command = {
    requestId: "123e4567-e89b-42d3-a456-426614174000",
    expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
    reason: "No longer needed",
  };
  expect(orderCancellationCommandSchema.safeParse(command).success).toBe(true);
  for (const change of [
    { requestId: "same" },
    { expectedUpdatedAt: "2026-10-10T12:00:00Z" },
    { expectedUpdatedAt: "bad" },
    { buyerId: "other" },
  ])
    expect(orderCancellationCommandSchema.safeParse({ ...command, ...change }).success).toBe(false);
  const receipt = {
    kind: "unpaid_order_cancelled",
    orderId: "ord_a",
    requestId: command.requestId,
    cancelledAt: command.expectedUpdatedAt,
  };
  expect(confirmedOrderCancellation(receipt, "ord_a", command.requestId)).toBe(true);
  expect(
    confirmedOrderCancellation({ ...receipt, orderId: "other" }, "ord_a", command.requestId),
  ).toBe(false);
});
