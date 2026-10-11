import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
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

import { SellerSalesRepository } from "../packages/db/src/repositories/seller-sales";

const repo = new SellerSalesRepository(),
  query = { page: 2, days: 30 as const, status: "completed" as const, evidence: "review" as const };
beforeEach(() => {
  state.queries = [];
  state.results = [];
  state.options = [];
});
it("holds live personal authority and a consistent bounded private report", async () => {
  state.results = [
    [],
    [],
    [["usr_a"]],
    [{ currency: "USD", lines: 21, orders: 20, gross: "9007199254740993", reviewLines: 2 }],
    [],
    [],
  ];
  expect(await repo.report("usr_a", query)).toMatchObject({
    scope: { id: "user:usr_a", name: null },
    total: 21,
    page: 2,
    totals: [{ gross: "9007199254740993" }],
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read" }]);
  expect(state.queries[2].sql).toContain("for share");
  const lines = state.queries[4];
  expect(lines.params.slice(-2)).toEqual([20, 20]);
  expect(lines.sql).toContain("p.organization_id IS NULL");
  expect(lines.sql).toContain("p.author_id =");
  expect(lines.sql).toContain('ORDER BY "createdAt" DESC,id DESC');
  expect(state.queries[5].sql).toContain("AT TIME ZONE 'UTC'");
  expect(state.queries[5].sql).toContain("LIMIT 128");
});
it("payment attempts are aggregated before joining sale values", async () => {
  state.results = [[], [], [["usr_a"]], [], [], []];
  await repo.report("usr_a", query);
  const q = state.queries[3];
  expect(q.sql).toContain("CROSS JOIN LATERAL");
  expect(q.sql).toContain("count(DISTINCT");
  expect(q.sql).toContain("pay.captures <> 1");
  expect(q.sql).toContain("pay.mismatch");
  expect(q.sql).not.toMatch(/inner join "payments"/i);
  expect(q.params).toContain("review");
  expect(q.sql).toContain("ELSE NULL END AS gross");
});
it.each(["member", "moderator", "developer"])(
  "refuses organization finances to a %s even with product management",
  async (role) => {
    state.results = [[], [], [["org_a", "someone", "Org"]], [["usr_a"]], [[role]]];
    await expect(repo.report("usr_a", { ...query, organizationId: "org_a" })).rejects.toMatchObject(
      { statusCode: 404 },
    );
    expect(state.queries).toHaveLength(5);
  },
);
it.each(["admin", "owner"])(
  "accepts a live organization %s and excludes personal portfolio",
  async (role) => {
    state.results = [[], [], [["org_a", "someone", "Org"]], [["usr_a"]], [[role]], [], [], []];
    expect(await repo.report("usr_a", { ...query, organizationId: "org_a" })).toMatchObject({
      scope: { id: "org:org_a", name: "Org" },
    });
    expect(state.queries[4].sql).toContain("for share");
    expect(state.queries[5].sql).toContain("p.organization_id =");
    expect(state.queries[5].sql).not.toContain("p.author_id =");
  },
);
it("checks a product against the authorized portfolio before any report", async () => {
  state.results = [[], [], [["usr_a"]], []];
  await expect(repo.report("usr_a", { ...query, productId: "prd_other" })).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(4);
  expect(state.queries[3].params).toEqual(["prd_other", "usr_a"]);
});
it("a detail is scoped by line and portfolio and never projects buyer or other order lines", async () => {
  state.results = [[], [], [["usr_a"]], []];
  await expect(repo.detail("usr_a", "itm_other")).rejects.toMatchObject({ statusCode: 404 });
  const q = state.queries[3];
  expect(q.sql).toContain("WHERE id =");
  expect(q.params.at(-1)).toBe("itm_other");
  for (const field of [
    "buyer_id",
    "email",
    "provider_transaction_id",
    "failure_reason",
    "ledger_entries",
    "license",
    "storage_key",
  ])
    expect(q.sql).not.toContain(field);
  expect(state.queries.some((q) => /^(insert|update|delete)/iu.test(q.sql))).toBe(false);
});
it("organization selector uses owner/admin authority and bounded stable paging", async () => {
  state.results = [[["usr_a"]], [{ total: 21 }], []];
  expect(await repo.scopes("usr_a", 2)).toMatchObject({ total: 21, page: 2 });
  expect(state.queries[2].params.slice(-2)).toEqual([20, 20]);
  expect(state.queries[1].sql).toContain("IN ('owner','admin')");
  expect(state.queries[1].sql).not.toContain("manage_products");
});

it("decodes raw driver timestamps and explicitly projects only a seller line", async () => {
  const createdAt = "2026-10-11 12:34:56+00";
  state.results = [
    [],
    [],
    [["usr_a"]],
    [
      {
        id: "itm_a",
        productId: "prd_a",
        productTitle: "Sale",
        orderNumber: "ORD",
        status: "completed",
        unitPrice: 10,
        currency: "USD",
        createdAt,
        evidence: "capture_recorded",
        buyerId: "SECRET",
        providerTransactionId: "SECRET",
      },
    ],
  ];
  const result = await repo.detail("usr_a", "itm_a");
  expect(result.sale.createdAt).toEqual(new Date("2026-10-11T12:34:56Z"));
  expect(JSON.stringify(result)).not.toContain("SECRET");
});
