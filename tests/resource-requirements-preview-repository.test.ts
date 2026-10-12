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
import { ResourceRequirementsRepository } from "../packages/db/src/repositories/resource-requirements";
const repo = new ResourceRequirementsRepository();
const date = "2026-10-12T00:00:00.000Z";
const input = {
  actorId: "usr_a",
  productId: "prd_a",
  scope: "library" as const,
  targetMta: "1.6.0",
  previewBuildId: "bld_preview",
};
const node = (extra = {}) => ({
  id: "prd_a",
  slug: "root",
  title: "Root",
  published: true,
  compatibility: { mtaMinVersion: "1.6.0", dependencies: [] },
  accessible: true,
  selection: "preview",
  buildId: "bld_preview",
  version: "2",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 100,
  safe: true,
  mtaTarget: "1.6.0",
  packageStatus: "checked",
  manifestStatus: "single",
  missingReferences: 0,
  issueCount: 0,
  ...extra,
});
const rows = (root = node()) => [
  [{ observedAt: date }],
  [],
  [],
  [["prd_a", "root", "usr_owner", null, 0]],
  [["usr_a"]],
  [root],
];
beforeEach(() => {
  h.rows = [];
  h.queries = [];
  h.options = [];
});
it("previews an owned exact safe release in a read-only database-clock snapshot", async () => {
  h.rows = rows(
    node({
      private: "SECRET-KEY",
      compatibility: { dependencies: [], mtaMinVersion: "1.6.0", private: "SECRET-EVIDENCE" },
    }),
  );
  const result = await repo.report(input);
  expect(result).toMatchObject({
    generatedAt: date,
    previewBuildId: "bld_preview",
    state: "ready",
    nodes: [{ selection: "preview", build: { id: "bld_preview" } }],
  });
  expect(JSON.stringify(result)).not.toContain("SECRET");
  expect(h.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const sql = h.queries.map((q) => q.sql).join("\n");
  expect(sql).toContain("transaction_timestamp()");
  expect(sql).not.toMatch(/for share|insert into|update |delete from/u);
  expect(h.queries.at(-1)?.params).toContain("bld_preview");
  expect(sql).toContain('"builds"."scan_status" =');
  expect(sql).toContain('"builds"."scanner" is not null');
  expect(sql).toContain("p.status = 'published' AND p.price = 0");
});
it("keeps dependency preferences scoped to their own releases", async () => {
  h.rows = [
    ...rows(node({ compatibility: { mtaMinVersion: "1.6.0", dependencies: ["dependency"] } })),
    [
      node({
        id: "prd_dep",
        slug: "dependency",
        selection: "fixed",
        buildId: "bld_dep",
        title: "Dependency",
      }),
    ],
  ];
  const result = await repo.report(input);
  expect(result.nodes.find((n) => n.id === "prd_dep")).toMatchObject({
    selection: "fixed",
    build: { id: "bld_dep" },
  });
  expect(h.queries.at(-1)?.params).not.toContain("bld_preview");
  expect(result.downloadableBytes).toBe(200);
});
it.each([
  { accessible: false },
  { buildId: null },
  { buildId: "bld_foreign" },
  { safe: false },
  { published: false },
])("never substitutes an inaccessible or unsafe preview %j", async (changed) => {
  h.rows = rows(node(changed));
  await expect(repo.report(input)).rejects.toMatchObject({ statusCode: 404 });
});
it("keeps ordinary reports on the current pin and marks them as non-preview", async () => {
  h.rows = rows(node({ selection: "fixed", buildId: "bld_current" }));
  expect(await repo.report({ ...input, previewBuildId: undefined })).toMatchObject({
    previewBuildId: null,
    nodes: [{ selection: "fixed", build: { id: "bld_current" } }],
  });
  expect(h.queries.at(-1)?.params).not.toContain("bld_preview");
});
it.each([
  { scope: "publisher" as const },
  { scope: "moderator" as const },
  { previewBuildId: "../private" },
  { previewBuildId: "" },
  { buildId: "bld_staff" },
])("rejects direct preview scope bypass before querying %j", async (changed) => {
  await expect(repo.report({ ...input, ...changed })).rejects.toMatchObject({
    code: "INVALID_REQUIREMENTS_QUERY",
  });
  expect(h.queries).toHaveLength(0);
});
it("fails closed when the snapshot time is unavailable", async () => {
  h.rows = [[{ observedAt: "invalid" }]];
  await expect(repo.report(input)).rejects.toMatchObject({ code: "REQUIREMENTS_TIME_UNKNOWN" });
  expect(h.queries).toHaveLength(1);
});

it("rejects an unknown direct scope instead of treating it as a private preview", async () => {
  await expect(
    repo.report({ ...input, previewBuildId: undefined, scope: "unknown" as "library" }),
  ).rejects.toMatchObject({ code: "INVALID_REQUIREMENTS_QUERY" });
  expect(h.queries).toHaveLength(0);
});
