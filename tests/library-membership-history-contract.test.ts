import { expect, it } from "vitest";
import {
  libraryMembershipHistoryQuery,
  libraryMembershipHistorySuffix,
} from "../apps/web/src/lib/library-membership-history-query";
it("defaults to bounded thirty-day group history and round-trips all selectors", () => {
  expect(libraryMembershipHistoryQuery(new URLSearchParams())).toEqual({
    page: 1,
    days: 30,
    operation: "all",
  });
  for (const operation of ["all", "additions", "removals", "mixed"]) {
    const query = libraryMembershipHistoryQuery(
      new URLSearchParams(
        `page=2&days=365&operation=${operation}&collectionId=lcol_a&productId=prd_a`,
      ),
    );
    expect(
      libraryMembershipHistoryQuery(new URLSearchParams(libraryMembershipHistorySuffix(query))),
    ).toEqual(query);
  }
});
it.each([
  "page=0",
  "page=01",
  "page=10000",
  "days=31",
  "days=030",
  "operation=add",
  "action=remove",
  "userId=other",
  "organizationId=other",
  "page=1&page=2",
  "productId=../secret",
  "collectionId=%00",
  "q=private",
  "pageSize=1000",
])("rejects malformed or unbounded selector %s", (value) =>
  expect(() => libraryMembershipHistoryQuery(new URLSearchParams(value))).toThrow(),
);
