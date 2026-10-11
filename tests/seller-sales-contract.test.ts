import { type SellerSale, sellerSaleEvidence, sellerSalesWindow } from "@nexus/domain";
import { expect, it } from "vitest";
import { sellerSalesCsv } from "../apps/web/src/lib/seller-sales-csv";
import {
  sellerSalesPageQuery,
  sellerSalesQuery,
  sellerSalesUrl,
} from "../apps/web/src/lib/seller-sales-query";

const base = {
  orderAmount: 100,
  lineAmount: 80,
  orderCurrency: "USD",
  lineCurrency: "USD",
  orderStatus: "completed",
  attempts: 1,
  captures: 1,
  completed: 1,
  refunds: 0,
  disputes: 0,
  mismatch: false,
};
it("distinguishes matching database captures from payment verification", () => {
  expect(sellerSaleEvidence(base)).toBe("capture_recorded");
  expect(sellerSaleEvidence({ ...base, completed: 0, refunds: 1, orderStatus: "refunded" })).toBe(
    "refund_recorded",
  );
  expect(sellerSaleEvidence({ ...base, completed: 0, disputes: 1 })).toBe("dispute_recorded");
  expect(
    sellerSaleEvidence({
      ...base,
      orderAmount: 0,
      lineAmount: 0,
      attempts: 0,
      captures: 0,
      completed: 0,
    }),
  ).toBe("free");
});
it.each([
  { orderAmount: -1 },
  { lineAmount: -1 },
  { lineAmount: 101 },
  { orderCurrency: "GBP" },
  { lineCurrency: "EUR" },
  { mismatch: true },
  { captures: 2 },
  { captures: 0 },
  { orderStatus: "refunded" },
  { orderAmount: 0, lineAmount: 0 },
  { orderAmount: 0, lineAmount: 0, attempts: 0, orderStatus: "refunded" },
])("marks inconsistent record %j for review", (patch) => {
  expect(sellerSaleEvidence({ ...base, ...patch })).toBe("review");
});
it.each([
  "userId=other",
  "organizationId=",
  "productId=../secret",
  "currency=GBP",
  "currency=all",
  "page=0",
  "page=10000",
  "page=1&page=2",
  "days=8",
  "status=pending",
  "evidence=paid",
  "organizationId=org%0A",
  "productId=x%27%20OR%201%3D1",
])("rejects malformed/private query %s", (query) => {
  expect(() => sellerSalesQuery(new URLSearchParams(query))).toThrow();
});
it("keeps all filters while paging, without exposing a user selector", () => {
  const q = sellerSalesQuery(
    new URLSearchParams(
      "page=2&days=90&currency=RUB&organizationId=org_a&productId=prd_a&status=all&evidence=review",
    ),
  );
  expect(q).toEqual({
    page: 2,
    days: 90,
    currency: "RUB",
    organizationId: "org_a",
    productId: "prd_a",
    status: "all",
    evidence: "review",
  });
  const url = sellerSalesUrl(q, 3, 2);
  expect(url).toContain("page=3");
  expect(url).toContain("organizationId=org_a");
  expect(url).toContain("scopePage=2");
  expect(sellerSalesPageQuery({ days: "7", scopePage: "3" })).toMatchObject({
    scopePage: 3,
    query: { days: 7 },
  });
  expect(() => sellerSalesPageQuery({ page: ["1", "2"] })).toThrow();
});
it("uses exact rolling cutoffs and bounded UTC calendar periods", () => {
  const now = new Date("2026-03-01T01:02:03Z");
  expect(sellerSalesWindow(7, now)).toEqual({
    cutoff: new Date("2026-02-22T01:02:03Z"),
    periodStart: new Date("2026-02-22T01:02:03Z"),
    periodUnit: "day",
  });
  expect(sellerSalesWindow("all", now)).toEqual({
    cutoff: null,
    periodStart: new Date("2025-04-01T00:00:00Z"),
    periodUnit: "month",
  });
  expect(sellerSalesWindow(365, now).periodUnit).toBe("month");
});
it("exports only line projections and neutralizes spreadsheet/control inputs", () => {
  const date = new Date("2026-10-11T00:00:00Z");
  const row = {
    id: "itm_a",
    productId: "prd_a",
    productTitle: '\t=IMPORTXML("evil")\n',
    orderNumber: "@bad",
    status: "completed",
    unitPrice: 80,
    currency: "USD",
    createdAt: date,
    evidence: "capture_recorded",
    buyerEmail: "secret@private",
    providerTransactionId: "SECRET",
  } as SellerSale;
  const csv = sellerSalesCsv([row], date);
  expect(csv).toContain('"\' =IMPORTXML(""evil"") "');
  expect(csv).toContain('"\'@bad"');
  expect(csv).toContain("line_value_minor_units");
  expect(csv).not.toContain("SECRET");
  expect(csv).not.toContain("secret@private");
  expect(() => sellerSalesCsv(Array(21).fill(row), date)).toThrow(RangeError);
});
