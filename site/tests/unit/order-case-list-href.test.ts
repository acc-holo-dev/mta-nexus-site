import { describe, expect, it } from "vitest";
import {
  orderCaseDetailHref,
  orderCaseListHref,
  orderCasePageQuery,
} from "../../src/features/commerce/order-case-query";

describe("order case list navigation hrefs", () => {
  const filters = orderCasePageQuery(
    { reviewStatus: "refund_recommended", threadStatus: "open", page: "3" },
    true,
  );

  it("round-trips list filters for back navigation", () => {
    expect(orderCaseListHref("/workspace/order-cases", filters)).toBe(
      "/workspace/order-cases?page=3&reviewStatus=refund_recommended&threadStatus=open",
    );
  });

  it("carries status filters on detail links without list page collision", () => {
    expect(orderCaseDetailHref("/workspace/order-cases", "sup_a", filters)).toBe(
      "/workspace/order-cases/sup_a?reviewStatus=refund_recommended&threadStatus=open",
    );
  });
});