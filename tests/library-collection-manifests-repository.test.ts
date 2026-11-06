import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryCollectionManifestsRepositoryDbMock } = await import(
    "./helpers/library-collection-manifests-repository-harness"
  );
  return createLibraryCollectionManifestsRepositoryDbMock();
});

import {
  exportLibraryCollection,
  previewLibraryCollectionImport,
} from "../packages/db/src/repositories/library-collection-manifests";
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
