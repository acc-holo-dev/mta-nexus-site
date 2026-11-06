import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createOrderTermsRepositoryDbMock } = await import(
    "./helpers/order-terms-repository-harness"
  );
  return createOrderTermsRepositoryDbMock();
});

import { OrderRepository } from "../packages/db/src/repositories/orders";
import {
  installOrderTermsRepositoryHooks,
  orderTermsRepositoryDate as date,
  orderTermsRepositoryInput as input,
  orderTermsRepositoryState as state,
  orderTermsRepositoryTerms as terms,
} from "./helpers/order-terms-repository-harness";

const orders = new OrderRepository();

installOrderTermsRepositoryHooks();

it("creates only validated pending orders from locked catalog terms and safe builds", async () => {
  state.rows = [
    [],
    [],
    [],
    [["prd_a", "published", 100, "USD", "single_server"]],
    [["usr_buyer"]],
    [["bld_a"]],
    [],
    [],
    [],
    [[date, "2026-10-11T00:00:00.001Z"]],
  ];
  const result = await orders.create(input);
  expect(result.status).toBe("pending");
  expect(result.updatedAt.toISOString()).toBe("2026-10-11T00:00:00.001Z");
  expect(state.queries[3].sql).toContain("for share");
  expect(state.queries[5].sql).toContain('"scanner"');
  expect(state.queries[5].sql).toContain("for share");
  const insert = state.queries[7];
  expect(insert.sql).toContain('"commercial_snapshot"');
  expect(insert.sql).toContain("default");
  expect(insert.params).not.toContain(terms);
  expect(state.queries.map((q) => q.sql).join("\n")).not.toMatch(
    /insert into "(?:payments|licenses|entitlements|ledger)/u,
  );
});
it("stale catalog economics and missing approved releases refuse creation before inserts", async () => {
  state.rows = [[], [], [], [["prd_a", "published", 99, "USD", "single_server"]]];
  await expect(orders.create(input)).rejects.toMatchObject({ code: "ORDER_CATALOG_CHANGED" });
  state.rows = [
    [],
    [],
    [],
    [["prd_a", "published", 100, "USD", "single_server"]],
    [["usr_buyer"]],
    [],
  ];
  await expect(orders.create(input)).rejects.toMatchObject({ code: "ORDER_CATALOG_CHANGED" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("old status primitives cannot fabricate a completed order or bypass cancellation audit", async () => {
  for (const status of ["completed", "refunded", "pending", "cancelled"] as const)
    await expect(orders.updateStatus("ord_a", status)).rejects.toMatchObject({
      code: "ORDER_CONFIRMATION_REQUIRED",
    });
  await expect(orders.create({ ...input, status: "completed" })).rejects.toMatchObject({
    code: "ORDER_CONFIRMATION_REQUIRED",
  });
  expect(state.queries).toHaveLength(0);
});
it("exact pending-order replays use frozen terms without rereading changed catalog or writing audit", async () => {
  state.rows = [
    [],
    [],
    [["ord_a", "NUMBER", "usr_buyer", "pending", 100, "USD", date, date]],
    [["usr_buyer"]],
    [["itm_a", "prd_a", 100, "USD", terms]],
  ];
  expect(await orders.create(input)).toMatchObject({ id: "ord_a", status: "pending" });
  expect(state.queries[1].params).toEqual(["order-create:ord_a"]);
  expect(
    state.queries.some((q) => q.sql.includes('from "products"') || q.sql.startsWith("insert")),
  ).toBe(false);
});
it("order-key reuse with different economics fails without rewriting the earlier request", async () => {
  state.rows = [[], [], [["ord_a", "NUMBER", "usr_buyer", "pending", 101, "USD", date, date]]];
  await expect(orders.create(input)).rejects.toMatchObject({ code: "ORDER_REQUEST_CONFLICT" });
  expect(state.queries).toHaveLength(3);
});
it("legacy pending orders cannot silently enter the recorded-terms pipeline on replay", async () => {
  state.rows = [
    [],
    [],
    [["ord_a", "NUMBER", "usr_buyer", "pending", 100, "USD", date, date]],
    [["usr_buyer"]],
    [["itm_a", "prd_a", 100, "USD", null]],
  ];
  await expect(orders.create(input)).rejects.toMatchObject({ code: "ORDER_TERMS_UNKNOWN" });
  expect(state.queries.some((q) => q.sql.startsWith("update") || q.sql.startsWith("insert"))).toBe(
    false,
  );
});
