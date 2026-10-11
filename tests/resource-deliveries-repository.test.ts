import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  const db: typeof raw = new Proxy(raw, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof raw) => unknown, options: unknown) => {
          state.options.push(options);
          return callback(db);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db };
});
import { resourceDeliveriesRepository as repo } from "../packages/db/src/repositories/resource-deliveries";
import { resourceDeliveriesQuery } from "../apps/web/src/lib/resource-deliveries-query";
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
});
it("counts and pages only personal evidence in a consistent bounded snapshot", async () => {
  state.rows = [
    [
      ["served", 23],
      ["failed", 1],
    ],
    [],
  ];
  const result = await repo.page(
    "usr_a",
    resourceDeliveriesQuery(new URLSearchParams("page=2&days=30&status=served&resourceId=prd_a")),
  );
  expect(result).toMatchObject({
    counts: { all: 24, served: 23, failed: 1 },
    total: 23,
    page: 2,
    totalPages: 2,
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const [totals, items] = state.queries;
  expect(totals.params).toContain("usr_a");
  expect(totals.params).toContain("prd_a");
  expect(totals.params).not.toContain("served");
  expect(items.params.slice(-2)).toEqual([20, 20]);
  expect(items.params).toContain("served");
  for (const evidence of [
    "entitlements",
    "licenses",
    "manage_products",
    "scanner",
    "scanned_at",
    "sha256_hash",
    "file_size_bytes",
    "case when",
  ])
    expect(items.sql).toContain(evidence);
  const projection = items.sql.slice(
    0,
    items.sql.indexOf(' from "resource_delivery_receipts" left'),
  );
  expect(projection).not.toMatch(/storage_key|license_key|token_digest/u);
});
it("hides another account's receipt behind the same not-found response", async () => {
  await expect(repo.detail("usr_other", "dlv_a")).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries[0].params.slice(-3)).toEqual(["dlv_a", "usr_other", 1]);
});
it("finishes once using live actor scoping, state CAS, bounded locks and atomic audit", async () => {
  state.rows = [[], [], [["dlv_a", "prd_a", "bld_a", "1.0.0"]], []];
  const result = { status: "served" as const, bytesSent: 7, errorCode: null };
  expect(
    await repo.finish({ userId: "usr_a", receiptId: "dlv_a", auditId: "aud_a", result }),
  ).toEqual({ id: "dlv_a", ...result });
  expect(state.queries[0].sql).toContain("lock_timeout");
  expect(state.queries[1].sql).toContain("statement_timeout");
  expect(state.queries[2].params).toContain("started");
  expect(state.queries[2].params).toContain("usr_a");
  expect(state.queries[3].params).toContain("product.download_finished");
  state.queries = [];
  state.rows = [[], [], []];
  expect(
    await repo.finish({ userId: "usr_a", receiptId: "dlv_a", auditId: "aud_b", result }),
  ).toBeNull();
  expect(state.queries).toHaveLength(3);
});
it("rejects non-finite or oversized terminal evidence before opening a transaction", async () => {
  await expect(
    repo.finish({
      userId: "usr_a",
      receiptId: "dlv_a",
      auditId: "aud_a",
      result: { status: "served", bytesSent: Number.NaN, errorCode: null },
    }),
  ).rejects.toMatchObject({ code: "DELIVERY_RESULT_INVALID" });
  expect(state.queries).toHaveLength(0);
});
it("revoked organization product authority cannot read buyer statistics", async () => {
  state.rows = [
    [["prd_a", "Private", "other", "org_a"]],
    [["owner"]],
    [["usr_a", "developer"]],
    [["member", []]],
  ];
  await expect(repo.publisher("prd_a", "usr_a", { days: "7", page: 1 })).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries.some((q) => q.sql.includes('from "resource_delivery_receipts"'))).toBe(
    false,
  );
});
it("publisher totals and twenty version groups expose no individual recipients", async () => {
  state.rows = [
    [["prd_a", "Title", "usr_a", null]],
    [["usr_a", "developer"]],
    [[29, 3, 20, 5, 1]],
    [[21]],
    [],
  ];
  const result = await repo.publisher("prd_a", "usr_a", { days: "90", page: 2 });
  expect(result).toMatchObject({
    product: { id: "prd_a", title: "Title" },
    counts: { all: 29, served: 20 },
    page: 2,
    totalPages: 2,
  });
  const aggregate = state.queries.at(-1);
  if (!aggregate) throw new Error("Missing aggregate query");
  expect(aggregate.params.slice(-2)).toEqual([20, 20]);
  expect(aggregate.params).toContain(90);
  expect(aggregate.sql).not.toMatch(/user_id|sha256_hash|error_code|access_source/u);
});
