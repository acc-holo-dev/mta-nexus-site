import { expect, it } from "vitest";
import {
  libraryCollectionManifestSchema,
  libraryCollectionImportPreviewSchema,
} from "../packages/validation/src/library-collections";
const collection = { id: "lcol_a", name: "Core", status: "active", revision: 1 },
  date = "2026-10-12T00:00:00.000Z";
const manifest = {
  schemaVersion: 1,
  generatedAt: date,
  collection,
  productIds: ["prd_b", "prd_a"],
};
it("canonicalizes a bounded portable reference manifest without granting authority", () => {
  expect(libraryCollectionManifestSchema.parse(manifest).productIds).toEqual(["prd_a", "prd_b"]);
  expect(libraryCollectionManifestSchema.parse({ ...manifest, productIds: [] }).productIds).toEqual(
    [],
  );
  expect(
    libraryCollectionManifestSchema.safeParse({
      ...manifest,
      productIds: Array.from({ length: 200 }, (_, i) => `prd_${i}`),
    }).success,
  ).toBe(true);
});
it.each([
  { ...manifest, schemaVersion: 2 },
  { ...manifest, userId: "other" },
  { ...manifest, downloadUrl: "private" },
  { ...manifest, productIds: ["prd_a", "prd_a"] },
  { ...manifest, productIds: ["../private"] },
  { ...manifest, generatedAt: "invalid" },
  { ...manifest, collection: { ...collection, ownerId: "other" } },
  { ...manifest, productIds: Array.from({ length: 201 }, (_, i) => `prd_${i}`) },
])("rejects unsafe, ambiguous or unbounded manifest %o", (value) =>
  expect(libraryCollectionManifestSchema.safeParse(value).success).toBe(false),
);
it("strictly verifies preview shape and neutralizes contradictory access/capacity flags", () => {
  const item = {
    productId: "prd_a",
    title: "Available",
    available: true,
    inCollection: false,
    canAdd: true,
  };
  const preview = {
    schemaVersion: 1,
    generatedAt: date,
    collection,
    itemCount: 0,
    itemLimit: 200,
    batchLimit: 20,
    items: [item],
  };
  expect(libraryCollectionImportPreviewSchema.safeParse(preview).success).toBe(true);
  for (const value of [
    { ...preview, storageKey: "private" },
    { ...preview, items: [item, item] },
    { ...preview, itemCount: 200 },
    { ...preview, collection: { ...collection, status: "archived" } },
    { ...preview, collection: { ...collection, revision: 2147483647 } },
    { ...preview, items: [{ ...item, inCollection: true }] },
    { ...preview, items: [{ ...item, available: false }] },
    { ...preview, itemLimit: 10000 },
    { ...preview, items: [{ ...item, accessGrant: "private" }] },
  ])
    expect(libraryCollectionImportPreviewSchema.safeParse(value).success).toBe(false);
});
