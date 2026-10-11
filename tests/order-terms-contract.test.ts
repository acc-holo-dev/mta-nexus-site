import { readOrderLineTerms, validatePendingOrder } from "@nexus/domain";
import { expect, it } from "vitest";
import { orderTermsId, orderTermsPageQuery } from "../apps/web/src/lib/order-terms-query";
import { sellerSalesCsv } from "../apps/web/src/lib/seller-sales-csv";
import {
  sellerSalesDetailQuery,
  sellerSalesQuery,
  sellerSalesUrl,
  sellerSaleUrl,
} from "../apps/web/src/lib/seller-sales-query";

const terms = {
  version: 1,
  recordedAt: "2026-10-11T00:00:00.000Z",
  product: { id: "prd_a", title: "At recording", slug: "resource" },
  seller: { type: "user", id: "usr_seller" },
  line: { unitPrice: 100, currency: "USD" },
  baseline: { commissionBps: 1000, holdDays: 7, licenseModel: "single_server" },
};
const order = {
  id: "ord_a",
  buyerId: "usr_buyer",
  orderNumber: "NEXUS-A",
  status: "pending" as const,
  totalAmount: 100,
  currency: "USD",
  items: [{ id: "itm_a", orderId: "ord_a", productId: "prd_a", unitPrice: 100, currency: "USD" }],
};
it("projects only recorded commercial terms without unknown JSON or secrets", () => {
  const projected = readOrderLineTerms({
    ...terms,
    licenseKey: "SECRET",
    product: { ...terms.product, storageKey: "SECRET" },
    seller: { ...terms.seller, email: "SECRET" },
    baseline: { ...terms.baseline, providerToken: "SECRET" },
  });
  expect(projected).toEqual(terms);
  expect(JSON.stringify(projected)).not.toContain("SECRET");
  expect(readOrderLineTerms(null)).toBeNull();
  expect(readOrderLineTerms({ ...terms, version: 2 })).toBeNull();
  expect(readOrderLineTerms({ ...terms, recordedAt: "not-a-date" })).toBeNull();
  expect(readOrderLineTerms({ ...terms, seller: { type: "admin", id: "usr_a" } })).toBeNull();
  expect(
    readOrderLineTerms({ ...terms, baseline: { ...terms.baseline, holdDays: 30 } }),
  ).toBeNull();
});
it("accepts a bounded pending order without changing caller data", () => {
  expect(validatePendingOrder(order)).toEqual(order.items);
  expect(order.status).toBe("pending");
});
it.each(["completed", "refunded", "processing", "cancelled"] as const)(
  "refuses fabricated %s order creation",
  (status) => {
    expect(() => validatePendingOrder({ ...order, status })).toThrowError(
      expect.objectContaining({ code: "ORDER_CONFIRMATION_REQUIRED" }),
    );
  },
);
it.each([
  { totalAmount: 99 },
  { totalAmount: -1 },
  { currency: "GBP" },
  { id: "../id" },
  { items: [] },
  { items: [{ ...order.items[0], orderId: "other" }] },
  { items: [{ ...order.items[0], unitPrice: -1 }] },
  { items: [{ ...order.items[0], currency: "EUR" }] },
  { items: [order.items[0], order.items[0]], totalAmount: 200 },
])("rejects malformed economics %j", (patch) => {
  expect(() => validatePendingOrder({ ...order, ...patch } as typeof order)).toThrow();
});
it.each([
  "page=0",
  "page=10000",
  "page=1&page=2",
  "page=1%0A",
  "buyerId=other",
  "pageSize=100",
  "scope=admin",
])("rejects unbounded/forged inspection %s", (value) => {
  expect(() => orderTermsPageQuery(new URLSearchParams(value))).toThrow();
});
it("preserves attribution in the report, CSV and exact-line URLs", () => {
  const query = sellerSalesQuery(
    new URLSearchParams("attribution=recorded&organizationId=org_a&productId=prd_a"),
  );
  expect(query.attribution).toBe("recorded");
  expect(sellerSalesUrl(query)).toContain("attribution=recorded");
  expect(sellerSaleUrl("itm_a", "org_a", "recorded")).toContain("attribution=recorded");
  expect(
    sellerSalesDetailQuery(new URLSearchParams("organizationId=org_a&attribution=recorded")),
  ).toEqual({ organizationId: "org_a", attribution: "recorded" });
  expect(() => sellerSalesDetailQuery(new URLSearchParams("userId=other"))).toThrow();
  expect(() => sellerSalesQuery(new URLSearchParams("attribution=paid"))).toThrow();
  expect(() => orderTermsId("id\n")).toThrow();
  const csv = sellerSalesCsv(
    [
      {
        id: "itm_a",
        productId: "prd_a",
        productTitle: "Frozen title",
        titleSource: "recorded",
        status: "completed",
        orderNumber: "ORDER",
        unitPrice: 100,
        currency: "USD",
        createdAt: new Date(),
        evidence: "review",
      },
    ],
    new Date(),
  );
  expect(csv).toContain('"Frozen title","recorded"');
  expect(csv.split("\r\n")[0]?.split(",")).toHaveLength(11);
});
