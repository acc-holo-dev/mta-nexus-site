import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createOrderTermsRepositoryDbMock } = await import(
    "./helpers/order-terms-repository-harness"
  );
  return createOrderTermsRepositoryDbMock();
});

import { OrderTermsRepository } from "../packages/db/src/repositories/order-terms";
import { SellerSalesRepository } from "../packages/db/src/repositories/seller-sales";
import {
  installOrderTermsRepositoryHooks,
  orderTermsRepositoryRoot as root,
  orderTermsRepositoryState as state,
  orderTermsRepositoryTerms as terms,
} from "./helpers/order-terms-repository-harness";

const repo = new OrderTermsRepository(),
  sales = new SellerSalesRepository();

installOrderTermsRepositoryHooks();

it("checks live identity and buyer scope, decoding snapshots without current private catalog reads", async () => {
  state.rows = [
    [],
    [],
    [["usr_buyer", "user"]],
    [root],
    [{ currency: "USD", value: "100", lines: 21, legacyLines: 20, negative: false }],
    [["itm_a", "prd_a", 100, "USD", { ...terms, providerSecret: "SECRET" }]],
  ];
  const result = await repo.report("usr_buyer", "ord_a", "buyer", 2);
  expect(result).toMatchObject({
    page: 2,
    total: 21,
    summary: { legacyLines: 20, recordedLines: 1, amountMismatch: false, currencyMismatch: false },
    lines: [{ evidence: "recorded", terms }],
  });
  expect(result.order.createdAt).toBeInstanceOf(Date);
  expect(JSON.stringify(result)).not.toContain("SECRET");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read" }]);
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].params).toEqual(["ord_a", "usr_buyer", 1]);
  expect(state.queries[5].params.slice(-2)).toEqual([20, 20]);
  expect(state.queries.map((q) => q.sql).join("\n")).not.toContain('from "products"');
});
it.each(["user", "moderator"])("refuses privileged snapshots to a live %s", async (role) => {
  state.rows = [[], [], [["usr_a", role]]];
  await expect(repo.report("usr_a", "ord_a", "admin")).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries).toHaveLength(3);
});
it("cannot inspect another buyer's order and never writes grants or financial states", async () => {
  state.rows = [[], [], [["usr_buyer", "user"]], []];
  await expect(repo.report("usr_buyer", "ord_other", "buyer")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries[3].params).toContain("usr_buyer");
  expect(state.queries.some((q) => /^(insert|update|delete)/iu.test(q.sql))).toBe(false);
});
it("reports legacy and corrupt snapshots without pretending to reconstruct a title", async () => {
  state.rows = [
    [],
    [],
    [["usr_a", "admin"]],
    [root],
    [{ currency: "USD", value: "90", lines: 2, legacyLines: 1, negative: false }],
    [
      ["itm_a", "prd_a", 50, "USD", null],
      ["itm_b", "prd_b", 40, "USD", { ...terms, licenseKey: "SECRET" }],
    ],
  ];
  const result = await repo.report("usr_a", "ord_a", "admin");
  expect(result.summary.amountMismatch).toBe(true);
  expect(result.lines.map((row) => row.evidence)).toEqual(["legacy", "unrecognized"]);
  expect(result.lines.every((row) => row.terms === null)).toBe(true);
  expect(JSON.stringify(result)).not.toContain("SECRET");
});
it("keeps per-currency sums separate even when their arithmetic happens to match", async () => {
  state.rows = [
    [],
    [],
    [["usr_a", "admin"]],
    [root],
    [
      { currency: "EUR", value: "50", lines: 1, legacyLines: 1, negative: false },
      { currency: "USD", value: "50", lines: 1, legacyLines: 1, negative: false },
    ],
    [],
  ];
  expect((await repo.report("usr_a", "ord_a", "admin")).summary).toMatchObject({
    currencyMismatch: true,
    amountMismatch: true,
    totals: [
      { currency: "EUR", value: "50" },
      { currency: "USD", value: "50" },
    ],
  });
});
it("recorded seller reports use immutable ownership and frozen title instead of current ownership", async () => {
  state.rows = [
    [],
    [],
    [["usr_seller"]],
    [{ currency: "USD", lines: 1, orders: 1, gross: "100", reviewLines: 1 }],
    [],
    [],
  ];
  await sales.report("usr_seller", {
    page: 1,
    days: "all",
    status: "all",
    evidence: "all",
    attribution: "recorded",
  });
  const q = state.queries[3];
  expect(q.sql).toContain("i.commercial_snapshot->'seller'->>'id'");
  expect(q.sql).toContain("i.commercial_snapshot->'product'->>'title'");
  expect(q.sql).toContain("i.commercial_snapshot IS NOT NULL");
  expect(q.params).toContain("usr_seller");
});
