import { expect, it } from "vitest";
import { recordedLibraryRelease } from "../packages/domain/src/library-release-history";
import { libraryReleaseHistoryQuery } from "../apps/web/src/lib/library-release-history-query";
it("projects only recorded selection fields and an origin label", () => {
  expect(
    recordedLibraryRelease({
      mode: "fixed",
      buildId: "bld_a",
      revision: 2,
      batchReceiptId: "lsbr_a",
      ipAddress: "private",
      userAgent: "private",
    }),
  ).toEqual({ selection: { mode: "fixed", buildId: "bld_a", revision: 2 }, source: "batch" });
  expect(recordedLibraryRelease({ mode: "latest", buildId: null, revision: 1 })).toEqual({
    selection: { mode: "latest", buildId: null, revision: 1 },
    source: "individual",
  });
});
it.each([
  null,
  {},
  { mode: ["fixed"], buildId: "bld_a", revision: 1 },
  { mode: "fixed", buildId: "../unsafe", revision: 1 },
  { mode: "latest", buildId: "bld_a", revision: 1 },
  { mode: "fixed", buildId: "bld_a", revision: 0 },
  { mode: "latest", buildId: null, revision: "2" },
])("fails closed on malformed historical details %j", (value) => {
  expect(recordedLibraryRelease(value)).toEqual({ selection: null, source: "unknown" });
});
it("bounds periods, IDs and pagination and accepts an empty form filter", () => {
  expect(libraryReleaseHistoryQuery(new URLSearchParams("productId="))).toEqual({
    page: 1,
    days: 30,
  });
  expect(
    libraryReleaseHistoryQuery(new URLSearchParams("page=2&days=365&productId=prd_a")),
  ).toEqual({ page: 2, days: 365, productId: "prd_a" });
  for (const query of [
    "days=31",
    "days=030",
    "page=0",
    "page=1001",
    "userId=other",
    "days=7&days=30",
    "productId=../unsafe",
    "limit=500",
  ])
    expect(() => libraryReleaseHistoryQuery(new URLSearchParams(query))).toThrow();
});
