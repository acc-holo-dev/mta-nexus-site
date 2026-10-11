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
import { readLibraryReleaseHistory } from "../packages/db/src/repositories/library-release-history";
const date = "2026-10-12T00:00:00.000Z";
beforeEach(() => {
  h.rows = [];
  h.queries = [];
  h.options = [];
});
it("uses own-action scope, database time and a fixed page without returning raw audits", async () => {
  h.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [[21]],
    [
      {
        id: "aud_a",
        productId: "prd_a",
        createdAt: new Date(date),
        details: {
          mode: "fixed",
          buildId: "bld_a",
          revision: 2,
          batchReceiptId: "lsbr_a",
          ip: "private",
        },
        currentTitle: "Current title",
        currentSlug: "current",
        hasCurrentAccess: true,
        buildVersion: "1.0.0",
      },
    ],
  ];
  const result = await readLibraryReleaseHistory("usr_a", {
    page: 1000,
    days: 30,
    productId: "prd_a",
  });
  expect(result).toMatchObject({
    page: 2,
    pageSize: 20,
    generatedAt: date,
    items: [{ source: "batch", selection: { mode: "fixed", revision: 2 }, buildVersion: "1.0.0" }],
  });
  expect(JSON.stringify(result)).not.toContain("private");
  expect(JSON.stringify(result)).not.toContain("lsbr_a");
  expect(h.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(h.queries).toHaveLength(4);
  const sql = h.queries.map((q) => q.sql).join("\n");
  expect(sql).toContain("transaction_timestamp()");
  expect(sql).toContain("'library.release_selected'");
  expect(sql).toContain("'product'");
  expect(sql).toContain("'user'");
  expect(sql).toContain("jsonb_build_object");
  expect(sql).not.toMatch(/storage_key|ip_address|user_agent|insert into|update /u);
  expect(h.queries.at(-1)?.params).toContain("usr_a");
  expect(h.queries.at(-1)?.params).toContain("prd_a");
  expect(h.queries.at(-1)?.params).toContain(20);
});
it("retains own IDs after access loss and masks metadata defensively", async () => {
  h.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [[1]],
    [
      {
        id: "aud_a",
        productId: "prd_removed",
        createdAt: new Date(date),
        details: { mode: "fixed", buildId: "bld_old", revision: 3 },
        currentTitle: "secret",
        currentSlug: "secret",
        hasCurrentAccess: false,
        buildVersion: "secret",
      },
    ],
  ];
  expect(await readLibraryReleaseHistory("usr_a", { page: 1, days: 7 })).toMatchObject({
    items: [
      {
        productId: "prd_removed",
        selection: { buildId: "bld_old" },
        currentTitle: null,
        currentSlug: null,
        buildVersion: null,
      },
    ],
  });
});
it("does not require current resource access to show empty or recorded personal history", async () => {
  h.rows = [[["usr_a"]], [{ observedAt: date }], [[0]], []];
  expect(await readLibraryReleaseHistory("usr_a", { page: 1, days: 365 })).toMatchObject({
    total: 0,
    items: [],
  });
  expect(h.queries.some((q) => q.sql.includes("for share"))).toBe(false);
});
it("requires a live account before reading history and rejects direct invalid queries", async () => {
  await expect(readLibraryReleaseHistory("usr_a", { page: 0, days: 30 })).rejects.toMatchObject({
    code: "RESOURCE_CONTROL_INVALID",
  });
  expect(h.queries).toHaveLength(0);
  h.rows = [[]];
  await expect(readLibraryReleaseHistory("usr_a", { page: 1, days: 30 })).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(h.queries).toHaveLength(1);
});
