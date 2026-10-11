import { expect, it } from "vitest";
import { collectionReleasesQuery } from "../apps/web/src/lib/collection-releases-query";
import { collectionReleasesCopy } from "../apps/web/src/lib/collection-releases-i18n";
it("bounds filters, pages and literal private searches", () => {
  expect(collectionReleasesQuery(new URLSearchParams())).toEqual({ page: 1, q: "", filter: "all" });
  expect(
    collectionReleasesQuery(new URLSearchParams("filter=updates&page=2&q=100%25_%5C")),
  ).toEqual({ page: 2, q: "100%_\\", filter: "updates" });
  for (const query of [
    "filter=missing",
    "page=0",
    "page=10000",
    "q=x&q=y",
    "filter=all&filter=pinned",
    "userId=other",
    "status=archived",
    "q=%00",
    `q=${"x".repeat(81)}`,
  ])
    expect(() => collectionReleasesQuery(new URLSearchParams(query))).toThrow();
});
it("explains snapshot scope and archived inspection in RU/EN", () => {
  expect(collectionReleasesCopy("ru").title).toContain("коллекции");
  expect(collectionReleasesCopy("en").note).toContain("does not change versions");
  expect(collectionReleasesCopy("ru").archived).toContain("Восстановите");
});
