import { expect, it } from "vitest";
import { resourceCartAcquisitionSchema } from "@nexus/validation";
import {
  resourceCartReceiptId,
  resourceCartReceiptQuery,
  resourceCartReceiptsUrl,
} from "../apps/web/src/lib/resource-cart-receipts-query";
import { confirmedResourceCartReview } from "../apps/web/src/lib/resource-cart-review-confirmation";
import { resourceCartReceiptsCsv } from "../apps/web/src/lib/resource-cart-receipts-csv";
const requestId = "11111111-1111-4111-8111-111111111111";
const item = {
  productId: "prd_a",
  title: "Resource",
  slug: "resource",
  version: "1.0.0",
  buildId: "bld_a",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 7,
  mtaMinVersion: null,
  dependencies: ["base_resource"],
  available: true,
  alreadyOwned: false,
};
it("requires explicit review evidence and refuses actor/payment selectors", () => {
  const command = { productIds: ["prd_a"], requestId, reviewDigest: "a".repeat(64) };
  expect(resourceCartAcquisitionSchema.parse(command)).toEqual(command);
  for (const value of [
    { productIds: ["prd_a"], requestId },
    { ...command, reviewDigest: "A".repeat(64) },
    { ...command, userId: "other" },
    { ...command, price: 0 },
    { ...command, productIds: ["prd_a", "prd_a"] },
  ])
    expect(resourceCartAcquisitionSchema.safeParse(value).success).toBe(false);
});
it("confirms exact bounded review facts and rejects hidden or malformed evidence", () => {
  const value = { items: [item], limit: 20, reviewDigest: "a".repeat(64) };
  expect(confirmedResourceCartReview(value)).toEqual(value);
  for (const change of [
    { buildId: "../secret" },
    { sha256Hash: "" },
    { fileSizeBytes: 0 },
    { fileSizeBytes: 67108865 },
    { dependencies: [42] },
    { dependencies: ["../secret"] },
    { available: false },
  ])
    expect(confirmedResourceCartReview({ ...value, items: [{ ...item, ...change }] })).toBeNull();
  expect(confirmedResourceCartReview({ ...value, reviewDigest: null })).toBeNull();
  expect(confirmedResourceCartReview({ items: [], limit: 20, reviewDigest: null })).toBeTruthy();
});
it("bounds filters, rejects repeated selectors and preserves pagination/export query", () => {
  const query = resourceCartReceiptQuery(new URLSearchParams("days=90&evidence=legacy&page=3"));
  expect(query).toEqual({ days: 90, evidence: "legacy", page: 3 });
  expect(
    resourceCartReceiptQuery(
      new URL(resourceCartReceiptsUrl(query), "https://nexus.test").searchParams,
    ),
  ).toEqual(query);
  for (const value of [
    "days=8",
    "evidence=paid",
    "page=01",
    "page=10000",
    "page=2&page=3",
    "userId=other",
    "limit=1000",
  ])
    expect(() => resourceCartReceiptQuery(new URLSearchParams(value))).toThrow();
  expect(resourceCartReceiptId(requestId)).toBe(requestId);
  expect(() => resourceCartReceiptId("../private")).toThrow();
});
it("exports only a bounded page with formula/quote escaping and explicit legacy evidence", () => {
  const row = {
    requestId: '=HYPERLINK("x")',
    createdAt: new Date("2026-10-11T00:00:00Z"),
    reviewed: false,
    itemCount: 2,
  };
  const csv = resourceCartReceiptsCsv([row]);
  expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  expect(csv).toContain('"legacy"');
  expect(csv).not.toContain("user_id");
  expect(() => resourceCartReceiptsCsv(Array.from({ length: 21 }, () => row))).toThrow();
});
