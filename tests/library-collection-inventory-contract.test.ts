import { expect, it } from "vitest";
import {
  libraryCollectionInventoryQuery,
  libraryCollectionInventorySuffix,
} from "../apps/web/src/lib/library-collection-inventory-query";
it("defaults to all own references and round-trips exact filters and literal search", () => {
  expect(libraryCollectionInventoryQuery(new URLSearchParams())).toEqual({
    page: 1,
    status: "all",
    filter: "all",
    release: "all",
    q: "",
  });
  const query = libraryCollectionInventoryQuery(
    new URLSearchParams(
      "page=2&status=archived&filter=shared&q=%25_%5C&collectionId=lcol_a&release=updates",
    ),
  );
  expect(
    libraryCollectionInventoryQuery(new URLSearchParams(libraryCollectionInventorySuffix(query))),
  ).toEqual(query);
});
it.each([
  "page=0",
  "page=01",
  "page=10000",
  "page=1&page=2",
  "status=deleted",
  "filter=ready",
  "userId=other",
  "organizationId=other",
  "collectionId=../private",
  "q=%00",
  "pageSize=1000",
  "productId=prd_a",
  "release=private",
  "release=all&release=updates",
  "release=",
])("rejects ambiguous, injected or unsupported selector %s", (value) =>
  expect(() => libraryCollectionInventoryQuery(new URLSearchParams(value))).toThrow(),
);
