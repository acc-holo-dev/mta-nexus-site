import { expect, it } from "vitest";
import {
  libraryCollectionComparisonQuery,
  libraryCollectionComparisonSuffix,
} from "../apps/web/src/lib/library-collection-comparison-query";
import { libraryCollectionComparisonQuerySchema } from "../packages/validation/src/library-collections";
it("defaults to choosing a destination and round-trips a reviewed comparison query", () => {
  expect(libraryCollectionComparisonQuery(new URLSearchParams())).toEqual({
    to: undefined,
    page: 1,
    filter: "all",
    q: "",
    transfer: "copy",
  });
  const query = libraryCollectionComparisonQuery(
    new URLSearchParams("to=lcol_b&page=2&filter=common&q=%20safe%20&transfer=move"),
  );
  expect(query.q).toBe("safe");
  expect(
    libraryCollectionComparisonQuery(new URLSearchParams(libraryCollectionComparisonSuffix(query))),
  ).toEqual(query);
});
it.each([
  "userId=other",
  "organizationId=other",
  "to=a&to=b",
  "page=01",
  "to=a&page=10000",
  "q=secret",
  "filter=common",
  "to=a&filter=delete",
  "to=../private",
  "to=a&transfer=delete",
  "to=a&q=%00",
  "to=a&q=%0A",
  "to=a&pageSize=999",
])("rejects injected or unbounded comparison selector %s", (value) => {
  expect(() => libraryCollectionComparisonQuery(new URLSearchParams(value))).toThrow();
});
it("rejects direct invalid query objects including undeclared authority fields", () => {
  const query = { to: "lcol_b", page: 1, filter: "all", q: "", transfer: "copy" };
  for (const bad of [
    { ...query, userId: "other" },
    { ...query, q: "a".repeat(81) },
    { ...query, page: 1.5 },
    { ...query, q: "\u0000" },
  ])
    expect(libraryCollectionComparisonQuerySchema.safeParse(bad).success).toBe(false);
});
