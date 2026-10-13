import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
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

import {
  exportLibraryCollection,
  previewLibraryCollectionImport,
} from "../packages/db/src/repositories/library-collection-manifests";
const date = "2026-10-12T00:00:00.000Z",
  collection = { id: "lcol_a", name: "Own & name", status: "active", revision: 7 };
const manifest = () => ({
  schemaVersion: 1,
  generatedAt: "2000-01-01T00:00:00.000Z",
  collection: { ...collection, id: "lcol_foreign", name: "PRIVATE IMPORT NAME" },
  productIds: ["prd_a", "prd_b", "prd_c", "prd_d"],
});
const prefix = (status = "active", revision = 7) =>
  [
    [["usr_a"]],
    [["lcol_a", "Own & name", status, revision]],
    [{ observedAt: date }],
  ] as unknown[][];
const text = () => state.queries.map((q) => q.sql).join("\n");
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.options = [];
});
it("exports all own references including orphans without reading products, grants or storage", async () => {
  state.rows = [...prefix("archived"), [["prd_deleted"], ["prd_owned"]]];
  expect(await exportLibraryCollection("usr_a", "lcol_a")).toEqual({
    schemaVersion: 1,
    generatedAt: date,
    collection: { ...collection, status: "archived" },
    productIds: ["prd_deleted", "prd_owned"],
  });
  expect(state.queries[1]?.params).toEqual(["usr_a", "lcol_a", 1]);
  expect(state.queries[3]?.params.at(-1)).toBe(201);
  expect(text()).not.toMatch(
    /entitlements|licenses|builds|products|insert into|update |delete from/iu,
  );
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
});
it("bounds full exports and refuses inconsistent over-quota state", async () => {
  state.rows = [...prefix(), Array.from({ length: 200 }, (_, i) => [`prd_${i}`])];
  expect((await exportLibraryCollection("usr_a", "lcol_a")).productIds).toHaveLength(200);
  state.rows = [...prefix(), Array.from({ length: 201 }, (_, i) => [`prd_${i}`])];
  await expect(exportLibraryCollection("usr_a", "lcol_a")).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
});
it("previews untrusted references under current own access and preserves duplicates already in the target", async () => {
  state.rows = [
    ...prefix(),
    [[198]],
    [
      {
        productId: "prd_a",
        title: "Available",
        available: true,
        hasAccess: true,
        inCollection: false,
        storageKey: "PRIVATE",
      },
      {
        productId: "prd_b",
        title: "PRIVATE",
        available: false,
        hasAccess: false,
        inCollection: false,
      },
      {
        productId: "prd_c",
        title: "PRIVATE",
        available: false,
        hasAccess: true,
        inCollection: false,
      },
      {
        productId: "prd_d",
        title: "PRIVATE",
        available: false,
        hasAccess: false,
        inCollection: true,
      },
    ],
  ];
  const result = await previewLibraryCollectionImport("usr_a", "lcol_a", manifest());
  expect(result).toMatchObject({
    generatedAt: date,
    collection,
    itemCount: 198,
    itemLimit: 200,
    batchLimit: 20,
    items: [
      { productId: "prd_a", title: "Available", canAdd: true, inCollection: false },
      { productId: "prd_b", title: null, canAdd: false },
      { productId: "prd_c", title: null, canAdd: true },
      { productId: "prd_d", title: null, canAdd: false, inCollection: true },
    ],
  });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(JSON.stringify(result)).not.toContain("2000-01");
  expect(state.queries).toHaveLength(5);
  expect(state.queries[1]?.params).toContain("usr_a");
  expect(state.queries[4]?.params).toContain("usr_a");
  expect(state.queries[4]?.params).toContain("lcol_a");
  expect(text()).toContain("transaction_timestamp()");
  expect(text()).toContain("'product.download'");
  expect(text()).toContain("'published'");
  expect(state.queries[4]?.params).toContain("clean");
  expect(text()).not.toMatch(/insert into|update |delete from|for update/iu);
});
it.each([
  ["archived", 7, 1],
  ["active", 2147483647, 1],
  ["active", 7, 200],
] as const)(
  "allows read-only preview but no additions for %s/%s/%s",
  async (status, revision, total) => {
    state.rows = [
      ...prefix(status, revision),
      [[total]],
      [
        {
          productId: "prd_a",
          title: "Available",
          available: true,
          hasAccess: true,
          inCollection: false,
        },
      ],
    ];
    expect(
      (await previewLibraryCollectionImport("usr_a", "lcol_a", manifest())).items.every(
        (row) => !row.canAdd,
      ),
    ).toBe(true);
  },
);
it("does not disclose unknown reference labels and handles empty input without metadata reads", async () => {
  state.rows = [...prefix(), [[0]], []];
  const result = await previewLibraryCollectionImport("usr_a", "lcol_a", manifest());
  expect(result.items.every((row) => row.title === null && !row.canAdd && !row.available)).toBe(
    true,
  );
  state.queries = [];
  state.rows = [...prefix(), [[0]]];
  expect(
    (await previewLibraryCollectionImport("usr_a", "lcol_a", { ...manifest(), productIds: [] }))
      .items,
  ).toEqual([]);
  expect(state.queries).toHaveLength(4);
});
it("rejects invalid files before SQL and verifies target ownership before inspecting imported references", async () => {
  for (const value of [
    { ...manifest(), ownerId: "other" },
    { ...manifest(), productIds: ["../private"] },
    { ...manifest(), productIds: ["prd_a", "prd_a"] },
  ])
    await expect(previewLibraryCollectionImport("usr_a", "lcol_a", value)).rejects.toMatchObject({
      statusCode: 400,
    });
  await expect(exportLibraryCollection("usr_a", "../secret")).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
  state.rows = [[["usr_a"]], []];
  await expect(
    previewLibraryCollectionImport("usr_a", "lcol_foreign", manifest()),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(2);
  state.queries = [];
  state.rows = [[]];
  await expect(exportLibraryCollection("usr_deleted", "lcol_a")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
});
it("rejects invalid database time or count rather than trusting manifest metadata", async () => {
  state.rows = [[["usr_a"]], [["lcol_a", "Name", "active", 1]], [{ observedAt: "invalid" }]];
  await expect(exportLibraryCollection("usr_a", "lcol_a")).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
  state.rows = [...prefix(), [[201]]];
  await expect(previewLibraryCollectionImport("usr_a", "lcol_a", manifest())).rejects.toMatchObject(
    { code: "COLLECTION_SNAPSHOT_INVALID" },
  );
});

it("reviews the whole own/file union for selected reconciliation even when the collection is full", async () => {
  const ids = Array.from({ length: 200 }, (_, i) => `prd_old_${i}`);
  state.rows = [
    ...prefix(),
    [[200]],
    ids.map((id) => [id]),
    [
      {
        productId: "prd_new",
        title: "Accessible",
        available: true,
        hasAccess: true,
        inCollection: false,
      },
      {
        productId: ids[0],
        title: "PRIVATE",
        available: false,
        hasAccess: false,
        inCollection: true,
      },
    ],
  ];
  const report = await previewLibraryCollectionImport(
    "usr_a",
    "lcol_a",
    { ...manifest(), productIds: ["prd_new", ids[0]] },
    true,
  );
  expect(report.items).toHaveLength(201);
  expect(report.items.find((row) => row.productId === "prd_new")).toMatchObject({
    canAdd: true,
    inManifest: true,
    inCollection: false,
    canRemove: false,
  });
  expect(report.items.find((row) => row.productId === ids[0])).toMatchObject({
    canRemove: false,
    inManifest: true,
    title: null,
  });
  expect(report.items.filter((row) => row.canRemove)).toHaveLength(199);
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(state.queries).toHaveLength(6);
  expect(state.queries[4]?.params.at(-1)).toBe(201);
});
it("allows reviewing an empty file as explicit removable differences and rejects inconsistent own counts", async () => {
  state.rows = [...prefix(), [[1]], [["prd_orphan"]], []];
  const report = await previewLibraryCollectionImport(
    "usr_a",
    "lcol_a",
    { ...manifest(), productIds: [] },
    true,
  );
  expect(report.items).toEqual([
    {
      productId: "prd_orphan",
      title: null,
      available: false,
      inCollection: true,
      inManifest: false,
      canAdd: false,
      canRemove: true,
    },
  ]);
  state.rows = [...prefix(), [[2]], [["prd_orphan"]]];
  await expect(
    previewLibraryCollectionImport("usr_a", "lcol_a", manifest(), true),
  ).rejects.toMatchObject({ code: "COLLECTION_SNAPSHOT_INVALID" });
});
