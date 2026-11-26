import { expect, it } from "vitest";
import {
  purchasesDetailHref,
  purchasesListHref,
  purchasesListPageFromDetail,
} from "../../src/features/commerce/purchases-history-query";

it("keeps purchase list page on detail links without colliding with item page", () => {
  expect(purchasesListHref("/workspace/purchases", 1)).toBe("/workspace/purchases");
  expect(purchasesListHref("/workspace/purchases", 4)).toBe("/workspace/purchases?page=4");
  expect(purchasesDetailHref("/workspace/purchases", "ord_a", 1)).toBe(
    "/workspace/purchases/ord_a",
  );
  expect(purchasesDetailHref("/workspace/purchases", "ord_a", 4)).toBe(
    "/workspace/purchases/ord_a?fromPage=4",
  );
  expect(purchasesListPageFromDetail({})).toBe(1);
  expect(purchasesListPageFromDetail({ fromPage: "4" })).toBe(4);
});
