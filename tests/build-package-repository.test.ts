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
import { buildPackageComparisonRepository as repo } from "../packages/db/src/repositories/build-package-comparison";
const input = {
  actorId: "usr_owner",
  productId: "prd_a",
  buildId: "bld_a",
  baselineId: "bld_b",
  filter: "changed" as const,
  page: 2,
};
const product = ["prd_a", "Private resource", "usr_owner", null];
const current = ["bld_a", "2.0.0", "2026-10-11T02:00:00Z", "a".repeat(64), true];
const baseline = ["bld_b", "1.0.0", "2026-10-11T01:00:00Z", "b".repeat(64), true];
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
});
it("locks live authority, scopes both versions and pages bounded content changes", async () => {
  state.rows = [
    [product],
    [["usr_owner", "developer"]],
    [current],
    [baseline],
    [
      { status: "changed", total: 22 },
      { status: "added", total: 1 },
    ],
    [
      {
        path: "server.lua",
        status: "changed",
        beforeHash: "b".repeat(64),
        afterHash: "a".repeat(64),
        beforeSize: 1,
        afterSize: 2,
      },
    ],
    [["bld_b", "1.0.0"]],
  ];
  const result = await repo.page(input);
  expect(result).toMatchObject({
    page: 2,
    total: 22,
    pageSize: 20,
    comparisonAvailable: true,
    files: [{ path: "server.lua", status: "changed" }],
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read" }]);
  expect(state.queries[0]?.sql).toContain("for no key update");
  expect(state.queries[1]?.sql).toContain("for share");
  for (const index of [2, 3]) {
    expect(state.queries[index]?.sql).toContain('"builds"."product_id" =');
    expect(state.queries[index]?.sql).toContain("for share");
    expect(state.queries[index]?.params).toContain("prd_a");
  }
  const files = state.queries.at(-2);
  expect(files?.sql).toContain("FULL OUTER JOIN");
  expect(files?.sql).toContain("IS DISTINCT FROM");
  expect(files?.params.slice(-3)).toEqual(["changed", 20, 20]);
  expect(files?.sql).not.toMatch(/storage_key|token_digest|license_key/u);
  expect(state.queries.at(-1)?.params.at(-1)).toBe(20);
});
it("hides file metadata after personal management authority is lost", async () => {
  state.rows = [[product], [["usr_other", "user"]]];
  await expect(repo.page({ ...input, actorId: "usr_other" })).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(2);
});
it("requires current organization grants, not historical authorship", async () => {
  state.rows = [
    [product.slice(0, 3).concat("org_a")],
    [["usr_other"]],
    [["usr_owner", "developer"]],
    [],
  ];
  await expect(repo.page(input)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries[1]?.sql).toContain('from "organizations"');
  expect(state.queries[3]?.sql).toContain('from "organization_members"');
  expect(state.queries).toHaveLength(4);
});
it("holds the actual moderator grant and rejects a removed role before reading files", async () => {
  state.rows = [[product], [["user"]]];
  await expect(repo.page({ ...input, staff: true })).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries).toHaveLength(2);
});
it("does not accept a baseline from another product", async () => {
  state.rows = [[product], [["usr_owner", "developer"]], [current], []];
  await expect(repo.page(input)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(4);
  expect(state.queries[3]?.params).toContain("prd_a");
  expect(state.queries[3]?.params).toContain("bld_b");
});
it("uses an earlier safely published default baseline and does not invent legacy changes", async () => {
  state.rows = [
    [product],
    [["usr_owner", "developer"]],
    [current],
    [[...baseline.slice(0, 4), false]],
    [{ status: "recorded", total: 1 }],
    [
      {
        path: "meta.xml",
        status: "recorded",
        beforeHash: null,
        afterHash: "a".repeat(64),
        beforeSize: null,
        afterSize: 10,
      },
    ],
    [],
  ];
  expect(await repo.page({ ...input, baselineId: undefined })).toMatchObject({
    filter: "all",
    comparisonAvailable: false,
    files: [{ status: "recorded", beforeHash: null }],
  });
  const sql = state.queries[3]?.sql ?? "";
  for (const field of ["created_at", "scan_status", "scanner", "scanned_at"])
    expect(sql).toContain(field);
  expect(state.queries[3]?.params).toContain("published");
  expect(state.queries[4]?.params).toContain(null);
  expect(state.queries[4]?.sql).toContain("ELSE '[]'::jsonb");
});
it("does not invoke JSON recordset on a build without an inventory", async () => {
  state.rows = [
    [product],
    [["usr_owner", "developer"]],
    [[...current.slice(0, 4), false]],
    [baseline],
    [],
  ];
  expect(await repo.page(input)).toMatchObject({ files: [], total: 0, comparisonAvailable: false });
  expect(state.queries.some((v) => v.sql.includes("jsonb_to_recordset"))).toBe(false);
});
it("rejects a self comparison before starting a transaction", async () => {
  await expect(repo.page({ ...input, baselineId: "bld_a" })).rejects.toMatchObject({
    code: "BUILD_PACKAGE_BASELINE_INVALID",
  });
  expect(state.queries).toHaveLength(0);
});
