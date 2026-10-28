import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  config: null as unknown,
  failure: null as Error | null,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failure) throw state.failure;
    return { rows: state.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { ServerRepository } from "../packages/db/src/repositories/servers";
const repository = new ServerRepository();
beforeEach(() => {
  state.queries = [];
  state.config = null;
  state.failure = null;
  state.results = [
    [["125"]],
    [
      [
        "server",
        "Server",
        "server",
        "203.0.113.7",
        22003,
        "org",
        "maintenance",
        "private",
        true,
        "2026-10-09T12:00:00Z",
      ],
    ],
  ];
});
afterEach(() => {
  vi.restoreAllMocks();
});
it("uses user-scoped EXISTS checks without multiplying organization matches", async () => {
  const result = await repository.pageManagedByUser("actor", 2);
  expect(result).toMatchObject({ total: 125, page: 2, pageSize: 12, totalPages: 11 });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(2);
  for (const query of state.queries) {
    expect(query.params.filter((value) => value === "actor")).toHaveLength(3);
    expect(query.params).toEqual(
      expect.arrayContaining(["admin", "member", "developer", '["manage_servers"]']),
    );
    expect(query.sql).toContain('"servers"."organization_id" is null');
    expect(query.sql).toContain('"organizations"."owner_id"');
    expect(query.sql).toContain('"organization_members"."user_id"');
    expect(query.sql.match(/exists \(select/g)).toHaveLength(2);
    expect(query.sql).not.toContain(" join ");
  }
  expect(state.queries[1].params.slice(-2)).toEqual([12, 12]);
  expect(result.servers[0]).toMatchObject({
    id: "server",
    visibility: "private",
    organizationId: "org",
    updatedAt: new Date("2026-10-09T12:00:00Z"),
  });
});
it("projects ten card fields and retains stable timestamp/ID ordering", async () => {
  await repository.pageManagedByUser("actor");
  const query = state.queries[1].sql;
  expect(query).toContain('order by "servers"."updated_at" desc, "servers"."id" desc');
  const selection = query.slice(0, query.indexOf(' from "servers"'));
  for (const field of [
    "description",
    "media_urls",
    "gameplay_tags",
    "banner_url",
    "current_players",
    "observation_source",
    "owner_id",
  ])
    expect(selection).not.toContain(`"${field}"`);
});
it("applies identical filters to count and page with literal LIKE search", async () => {
  await repository.pageManagedByUser("actor", 1, {
    query: "  name_%\\  ",
    status: "maintenance",
    visibility: "private",
    verification: "unverified",
  });
  const [count, page] = state.queries;
  const condition = (query: string) => query.slice(query.indexOf(" where ")).split(" order by ")[0];
  expect(condition(count.sql)).toBe(condition(page.sql));
  expect(page.params.slice(0, -1)).toEqual(count.params);
  expect(count.params).toEqual(
    expect.arrayContaining(["maintenance", "private", false, "%name\\_\\%\\\\%"]),
  );
  expect(count.sql).not.toContain("name_%");
});
it.each([
  [NaN, NaN, 1, 12],
  [Infinity, Infinity, 1, 12],
  [-3, -5, 1, 1],
  [1.2, 1000, 1, 50],
  [999999, 12, 11, 12],
] as const)("bounds page %s and size %s", async (page, size, expectedPage, expectedSize) => {
  expect(await repository.pageManagedByUser("actor", page, {}, size)).toMatchObject({
    page: expectedPage,
    pageSize: expectedSize,
  });
});
it("skips the row query for empty results and clamps to page one", async () => {
  state.results = [[["0"]]];
  expect(await repository.pageManagedByUser("actor", 100)).toMatchObject({
    servers: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  expect(state.queries).toHaveLength(1);
});
it("rejects missing actors and broken aggregates instead of removing the scope", async () => {
  await expect(repository.pageManagedByUser("")).rejects.toThrow();
  expect(state.queries).toHaveLength(0);
  state.results = [[["NaN"]]];
  await expect(repository.pageManagedByUser("actor")).rejects.toThrow(
    "Invalid managed server total",
  );
});
it("binds unusual actor IDs and propagates database failures", async () => {
  await repository.pageManagedByUser("actor_' --");
  for (const query of state.queries) {
    expect(query.params).toContain("actor_' --");
    expect(query.sql).not.toContain("actor_' --");
  }
  state.failure = new Error("Database unavailable");
  await expect(repository.pageManagedByUser("actor")).rejects.toThrow();
});
