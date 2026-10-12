import { expect, it } from "vitest";
import {
  libraryCollectionHistoryQuery,
  libraryCollectionHistorySuffix,
} from "../apps/web/src/lib/library-collection-history-query";
import { libraryCollectionReceiptSchema } from "../packages/validation/src/library-collections";
it("defaults to a bounded thirty-day own history and preserves all filters in links", () => {
  expect(libraryCollectionHistoryQuery(new URLSearchParams())).toEqual({
    page: 1,
    days: 30,
    action: "all",
  });
  const query = libraryCollectionHistoryQuery(
    new URLSearchParams("page=2&days=365&action=move-items&collectionId=lcol_a&productId=prd_a"),
  );
  expect(
    libraryCollectionHistoryQuery(new URLSearchParams(libraryCollectionHistorySuffix(query))),
  ).toEqual(query);
  expect(libraryCollectionHistoryQuery(new URLSearchParams("collectionId=&productId="))).toEqual({
    page: 1,
    days: 30,
    action: "all",
  });
});
it.each([
  "page=0",
  "page=10000",
  "page=01",
  "days=31",
  "days=030",
  "action=delete",
  "userId=other",
  "organizationId=other",
  "page=1&page=2",
  "productId=../secret",
  "collectionId=%00",
  "q=private",
  "pageSize=1000",
])("rejects malformed/unbounded history selector %s", (value) => {
  expect(() => libraryCollectionHistoryQuery(new URLSearchParams(value))).toThrow();
});
it("keeps receipt evidence strict and bounds snapshot revisions and hidden fields", () => {
  const command = {
    requestId: "67ca0352-de64-4af9-9e54-7d3c56fe8d89",
    action: "remove",
    expectedRevision: 1,
    productId: "prd_a",
  };
  const receipt = {
    id: "lcr_a",
    requestId: command.requestId,
    command,
    collection: { id: "lcol_a", name: "Core", status: "active", revision: 2 },
    createdAt: "2026-10-12T00:00:00.000Z",
  };
  expect(libraryCollectionReceiptSchema.safeParse(receipt).success).toBe(true);
  for (const bad of [
    { ...receipt, storageKey: "private" },
    { ...receipt, collection: { ...receipt.collection, revision: 2147483648 } },
    { ...receipt, collection: { ...receipt.collection, name: "unsafe\u0000" } },
    { ...receipt, command: { ...command, ownerId: "other" } },
  ])
    expect(libraryCollectionReceiptSchema.safeParse(bad).success).toBe(false);
});
