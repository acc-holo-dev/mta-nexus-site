import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryCollectionManifestsRepositoryDbMock } = await import(
    "./helpers/library-collection-manifests-repository-harness"
  );
  return createLibraryCollectionManifestsRepositoryDbMock();
});

import { previewLibraryCollectionImport } from "../packages/db/src/repositories/library-collection-manifests";
import {
  installLibraryCollectionManifestsRepositoryHooks,
  libraryCollectionManifestsRepositoryCollection as collection,
  libraryCollectionManifestsRepositoryDate as date,
  libraryCollectionManifestsRepositoryManifest as manifest,
  libraryCollectionManifestsRepositoryPrefix as prefix,
  libraryCollectionManifestsRepositoryState as state,
  libraryCollectionManifestsRepositoryText as text,
} from "./helpers/library-collection-manifests-repository-harness";

installLibraryCollectionManifestsRepositoryHooks();

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
