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
import { ResourceRequirementsRepository } from "../packages/db/src/repositories/resource-requirements";
const repo = new ResourceRequirementsRepository(),
  date = "2026-10-11T00:00:00.000Z";
const input = { actorId: "usr_a", collectionId: "lcol_a", targetMta: "1.6.0" };
function row(slug: string, dependencies: string[] = []) {
  return {
    id: `prd_${slug}`,
    slug,
    title: slug,
    published: true,
    compatibility: { mtaMinVersion: "1.6.0", dependencies },
    accessible: true,
    selection: "latest",
    buildId: `bld_${slug}`,
    version: "1",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 10,
    safe: true,
    mtaTarget: null,
    packageStatus: "checked",
    manifestStatus: "single",
    missingReferences: 0,
    issueCount: 0,
  };
}
const prefix = () =>
  [[], [], [["usr_a"]], [["lcol_a", "Core", "active", 3]], [{ observedAt: date }]] as unknown[][];
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
});
it("loads shared dependencies once per layer in a read-only consistent snapshot", async () => {
  state.rows = [
    ...prefix(),
    [{ slug: "aaa" }, { slug: "bbb" }],
    [row("aaa", ["shared"]), row("bbb", ["shared"])],
    [row("shared")],
  ];
  const result = await repo.collectionReport(input);
  expect(result.state).toBe("ready");
  expect(result.report.order).toEqual(["shared", "aaa", "bbb"]);
  expect(result.report.downloadableBytes).toBe(30);
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries.filter((q) => q.sql.includes("SELECT p.id,p.slug"))).toHaveLength(2);
  expect(state.queries.at(-1)?.params).toContain('["shared"]');
  expect(state.rows).toHaveLength(0);
});
it("masks revoked members before traversing their private graph", async () => {
  state.rows = [...prefix(), [{ slug: null }]];
  const result = await repo.collectionReport(input);
  expect(result).toMatchObject({
    state: "blocked",
    itemCount: 1,
    unavailableItemCount: 1,
    rootSlugs: [],
  });
  expect(result.report.nodes).toEqual([]);
  const sql = state.queries.at(-1)?.sql ?? "";
  expect(sql).toContain("CASE WHEN owned.resource_id IS NOT NULL");
  expect(sql).toContain("p.status='published' AND p.price=0");
  expect(sql).toContain('"builds"."scan_status"');
  expect(sql).not.toContain("p.title");
});
it("rejects foreign collections before consulting member metadata", async () => {
  state.rows = [[], [], [["usr_a"]], []];
  await expect(repo.collectionReport(input)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries.at(-1)?.params).toEqual(["lcol_a", "usr_a", 1]);
  expect(state.queries.some((q) => q.sql.includes("library_collection_items"))).toBe(false);
});
it("requires an existing account before any collection query", async () => {
  state.rows = [[], [], []];
  await expect(repo.collectionReport(input)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(3);
});
it("returns an empty collection without any graph query", async () => {
  state.rows = [...prefix(), []];
  expect(await repo.collectionReport(input)).toMatchObject({ state: "empty", itemCount: 0 });
  expect(state.queries).toHaveLength(6);
});
it("retains archived membership and reports unavailable pinned builds", async () => {
  const pre = prefix();
  pre[3] = [["lcol_a", "Core", "archived", 7]];
  state.rows = [...pre, [{ slug: "aaa" }], [{ ...row("aaa"), selection: "fixed", buildId: null }]];
  const result = await repo.collectionReport(input);
  expect(result.collection).toMatchObject({ status: "archived", revision: 7 });
  expect(result.state).toBe("blocked");
  expect(result.report.issues).toContainEqual({ code: "selection_unavailable", slug: "aaa" });
  expect(state.queries.at(-1)?.sql).toContain("WHEN pref.mode = 'fixed' THEN pref.build_id");
});
it("caps root queries at 48 and marks the whole collection incomplete", async () => {
  const roots = Array.from({ length: 49 }, (_, i) => `root-${String(i).padStart(2, "0")}`);
  state.rows = [
    ...prefix(),
    roots.map((slug) => ({ slug })),
    roots.slice(0, 48).map((slug) => row(slug)),
  ];
  const result = await repo.collectionReport(input);
  expect(result).toMatchObject({ state: "blocked", itemCount: 49 });
  expect(result.rootSlugs).toHaveLength(48);
  expect(result.report.truncated).toBe(true);
  expect(result.report.order).toEqual([]);
});
it("fails closed when database snapshot time cannot be read", async () => {
  const pre = prefix();
  pre[4] = [];
  state.rows = pre;
  await expect(repo.collectionReport(input)).rejects.toThrow("snapshot time");
  expect(state.queries).toHaveLength(5);
});
