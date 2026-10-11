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
  const database: typeof raw = new Proxy(raw, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof raw) => unknown, options: unknown) => {
          state.options.push(options);
          return callback(database);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: database };
});
import { resourcePublisherRepository as repo } from "../packages/db/src/repositories/resource-publisher";
import { resourcePublisherQuery } from "../apps/web/src/lib/resource-publisher-query";
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
});
it("counts and projects a bounded live managed inventory in one read-only snapshot", async () => {
  state.rows = [
    [
      ["draft", 22],
      ["published", 5],
    ],
    [],
  ];
  const query = resourcePublisherQuery(
    new URLSearchParams(
      "page=2&scope=organization&type=script&q=100%25_&status=draft&readiness=ready&sort=title",
    ),
  );
  const result = await repo.inventory("usr_a", query, query.page);
  expect(result).toMatchObject({
    statusCounts: { draft: 22, published: 5 },
    total: 22,
    page: 2,
    totalPages: 2,
    pageSize: 20,
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const [counts, rows] = state.queries;
  for (const part of [
    "organization_members",
    "manage_products",
    "users",
    "metadata_review_required",
    "scanner",
    "scanned_at",
  ])
    expect(counts.sql).toContain(part);
  expect(counts.params).toContain("%100\\%\\_%");
  expect(counts.params).toContain("usr_a");
  expect(rows.params.slice(-2)).toEqual([20, 20]);
  expect(rows.sql).toContain('order by "products"."title" asc, "products"."id" asc');
  const projection = rows.sql.slice(0, rows.sql.indexOf(' from "products"'));
  expect(projection).not.toMatch(/storage_key|license_key|author_id|token_digest/u);
});
it("keeps all status counts while applying the actual list status", async () => {
  state.rows = [
    [
      ["draft", 4],
      ["published", 6],
    ],
    [],
  ];
  const result = await repo.inventory(
    "usr_a",
    resourcePublisherQuery(new URLSearchParams("status=published")),
  );
  expect(result.total).toBe(6);
  expect(state.queries[0].params).not.toContain("published");
  expect(state.queries[1].params).toContain("published");
});
it("rechecks organization grants before exposing editorial history", async () => {
  state.rows = [
    [["prd_a", "Private", "other", "org_a"]],
    [["owner"]],
    [["usr_a", "developer"]],
    [["member", []]],
  ];
  await expect(repo.history("prd_a", "usr_a", "all")).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries.some((q) => q.sql.includes('from "audit_events"'))).toBe(false);
});
it("projects only safe events and literal owner reasons with bounded private pagination", async () => {
  state.rows = [[["prd_a", "Private", "usr_a", null]], [["usr_a", "developer"]], [[21]], []];
  const result = await repo.history("prd_a", "usr_a", "changes", 2);
  expect(result).toMatchObject({
    product: { id: "prd_a", title: "Private" },
    page: 2,
    totalPages: 2,
    total: 21,
  });
  const events = state.queries.at(-1);
  if (!events) throw new Error("Expected history query");
  expect(events.params.slice(-2)).toEqual([20, 20]);
  expect(events.sql).toContain("case when");
  expect(events.sql).not.toContain('"audit_events"."actor_id"');
  expect(events.params).toContain("product.details_updated");
  expect(events.params).not.toContain("product.archive");
});
