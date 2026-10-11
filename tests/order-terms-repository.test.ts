import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            state.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { OrderTermsRepository } from "../packages/db/src/repositories/order-terms";
import { OrderRepository } from "../packages/db/src/repositories/orders";
import { SellerSalesRepository } from "../packages/db/src/repositories/seller-sales";

const repo = new OrderTermsRepository(),
  orders = new OrderRepository(),
  sales = new SellerSalesRepository(),
  date = "2026-10-11T00:00:00Z";
const terms = {
  version: 1,
  recordedAt: "2026-10-11T00:00:00.000Z",
  product: { id: "prd_a", title: "Frozen", slug: "resource" },
  seller: { type: "user", id: "usr_seller" },
  line: { unitPrice: 100, currency: "USD" },
  baseline: { commissionBps: 1000, holdDays: 7, licenseModel: "single_server" },
};
const root = ["ord_a", "NUMBER", "pending", 100, "USD", date],
  input = {
    id: "ord_a",
    buyerId: "usr_buyer",
    orderNumber: "NUMBER",
    status: "pending" as const,
    totalAmount: 100,
    currency: "USD",
    items: [{ id: "itm_a", orderId: "ord_a", productId: "prd_a", unitPrice: 100, currency: "USD" }],
  };
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
});
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
  state.rows = [[], [], [], [["prd_a", "published", 100, "USD", "single_server"]], [["usr_buyer"]], []];
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
