import { createHash } from "node:crypto";
import { beforeEach } from "vitest";
import {
  collection,
  collectionRow,
  insertedReceipt,
  prefix,
  requestId,
  resetLibraryCollectionsRepositoryState,
  libraryCollectionsRepositoryState as state,
} from "./library-collections-repository-harness";

/** Full-collection duplicate command with stable source digest. */
export const copyCommand = (
  source = { ...collection, id: "lcol_source" },
  productIds = ["prd_a", "prd_b"],
) => ({
  requestId,
  action: "duplicate" as const,
  name: "Copy",
  sourceCollectionId: source.id,
  expectedRevision: source.revision,
  expectedItemCount: productIds.length,
  sourceDigest: createHash("sha256")
    .update(JSON.stringify({ source, productIds: [...productIds].sort() }))
    .digest("hex"),
});

/** Selected-item copy command fixture. */
export const copyItems = {
  requestId,
  action: "copy-items" as const,
  sourceCollectionId: "lcol_source",
  expectedSourceRevision: 4,
  productIds: ["prd_a", "prd_b"],
  expectedRevision: 1,
};

/** Prefix query rows shared by copy-items success and guard paths. */
export const copyPrefix = () =>
  [
    ...prefix(),
    [collectionRow()],
    [[0]],
    [collectionRow({ id: "lcol_source", name: "Archive", status: "archived", revision: 4 })],
    [["prd_a"], ["prd_b"]],
    [["prd_a"]],
    [[199]],
  ] as unknown[][];

/** Queue a successful selected-item copy row sequence. */
export const copySuccess = () => {
  state.rows = [
    ...copyPrefix(),
    [],
    [collectionRow({ revision: 2 })],
    [insertedReceipt(copyItems, { ...collection, revision: 2 })],
    [],
  ];
};

/** Selected-item move command fixture. */
export const moveItems = { ...copyItems, action: "move-items" as const };

/** Prefix query rows shared by move-items success and guard paths. */
export const movePrefix = () => {
  const rows = copyPrefix();
  rows[7] = [collectionRow({ id: "lcol_source", name: "Source", status: "active", revision: 4 })];
  rows.splice(8, 0, [[0]]);
  return rows;
};

/** Queue a successful selected-item move row sequence. */
export const moveSuccess = () => {
  state.rows = [
    ...movePrefix(),
    [],
    [["prd_a"], ["prd_b"]],
    [["lcol_source"]],
    [collectionRow({ revision: 2 })],
    [insertedReceipt(moveItems, { ...collection, revision: 2 })],
    [],
  ];
};

/** Register shared beforeEach reset for copy/move repository suites. */
export function setupLibraryCollectionsRepositoryCopyMove() {
  beforeEach(() => {
    resetLibraryCollectionsRepositoryState();
  });
}
