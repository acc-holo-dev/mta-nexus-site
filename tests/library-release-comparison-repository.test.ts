import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    h.queries.push({ sql, params });
    return { rows: h.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            h.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { readLibraryReleaseComparison } from "../packages/db/src/repositories/library-release-comparison";
const query = { from: "bld_a", to: "bld_b", returnPage: 2 },
  date = "2026-10-12T00:00:00.000Z";
const build = (id: string, hash = "a".repeat(64)) => [
  id,
  "1.0.0",
  date,
  hash,
  100,
  "resource.zip",
  "application/zip",
  null,
  null,
  false,
  null,
];
beforeEach(() => {
  h.rows = [];
  h.queries = [];
  h.options = [];
});
it("compares only same-resource safe releases in one entitled database-clock snapshot", async () => {
  h.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [
      {
        id: "prd_a",
        title: "Owned resource",
        slug: "owned",
        revision: 0,
        mode: "latest",
        buildId: null,
      },
    ],
    [build("bld_b", "b".repeat(64)), build("bld_a")],
  ];
  expect(await readLibraryReleaseComparison("usr_a", "prd_a", query)).toMatchObject({
    generatedAt: date,
    selection: { revision: 0, mode: "latest", buildId: null },
    returnPage: 2,
    artifactState: "different",
    from: { id: "bld_a" },
    to: { id: "bld_b" },
  });
  expect(h.queries).toHaveLength(4);
  expect(h.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const sql = h.queries.map((q) => q.sql).join("\n");
  expect(sql).toContain("transaction_timestamp()");
  expect(sql).toContain("product.status='published'");
  expect(sql).toContain("scanner");
  expect(sql).not.toMatch(/storage_key|ip_address|user_agent|insert into|update /u);
  expect(h.queries.at(-1)?.params).toContain("prd_a");
  expect(h.queries.at(-1)?.params.slice(-3)).toEqual(["bld_a", "bld_b", 2]);
});
it("requires current account and access before reading artifact metadata", async () => {
  h.rows = [[]];
  await expect(readLibraryReleaseComparison("usr_a", "prd_a", query)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(h.queries).toHaveLength(1);
  h.queries = [];
  h.rows = [[["usr_a"]], [{ observedAt: date }], []];
  await expect(readLibraryReleaseComparison("usr_a", "prd_a", query)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(h.queries).toHaveLength(3);
});
it("fails the whole comparison when a release is withdrawn, foreign or has invalid identity", async () => {
  h.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [{ id: "prd_a", title: "Owned", slug: "owned", revision: 0, mode: "latest", buildId: null }],
    [build("bld_a")],
  ];
  await expect(readLibraryReleaseComparison("usr_a", "prd_a", query)).rejects.toMatchObject({
    statusCode: 404,
  });
  h.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [{ id: "prd_a", title: "Owned", slug: "owned", revision: 0, mode: "latest", buildId: null }],
    [build("bld_a"), build("bld_b", "invalid")],
  ];
  await expect(readLibraryReleaseComparison("usr_a", "prd_a", query)).rejects.toMatchObject({
    code: "LIBRARY_COMPARISON_INVALID",
  });
});
it("rejects direct invalid scopes before opening a transaction", async () => {
  await expect(readLibraryReleaseComparison("usr_a", "../foreign", query)).rejects.toMatchObject({
    code: "RESOURCE_CONTROL_INVALID",
  });
  await expect(
    readLibraryReleaseComparison("usr_a", "prd_a", { ...query, to: "bld_a" }),
  ).rejects.toMatchObject({ code: "RESOURCE_CONTROL_INVALID" });
  expect(h.queries).toHaveLength(0);
});

it("includes only the actor's current preference without another query or metadata leak", async () => {
  h.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [
      {
        id: "prd_a",
        title: "Owned",
        slug: "owned",
        revision: 4,
        mode: "fixed",
        buildId: "bld_old",
        private: "SECRET",
      },
    ],
    [build("bld_a"), build("bld_b")],
  ];
  const result = await readLibraryReleaseComparison("usr_a", "prd_a", query);
  expect(result.selection).toEqual({ revision: 4, mode: "fixed", buildId: "bld_old" });
  expect(result.product).toEqual({ id: "prd_a", title: "Owned", slug: "owned" });
  expect(JSON.stringify(result)).not.toContain("SECRET");
  expect(h.queries).toHaveLength(4);
  expect(h.queries[2].sql).toContain('LEFT JOIN "resource_library_selections" preference');
  expect(h.queries[2].sql).toContain("preference.user_id=");
  expect(h.queries[2].params.filter((v) => v === "usr_a")).toHaveLength(3);
});
