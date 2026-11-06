import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryCollectionHistoryRepositoryDbMock } = await import(
    "./helpers/library-collection-history-repository-harness"
  );
  return createLibraryCollectionHistoryRepositoryDbMock();
});

import { readLibraryCollectionHistory } from "../packages/db/src/repositories/library-collection-history";
import {
  installLibraryCollectionHistoryRepositoryHooks,
  libraryCollectionHistoryRepositoryCommand as command,
  libraryCollectionHistoryRepositoryDate as date,
  libraryCollectionHistoryRepositoryPrefix as prefix,
  libraryCollectionHistoryRepositoryQuery as query,
  libraryCollectionHistoryRepositoryRequestId as requestId,
  libraryCollectionHistoryRepositoryRow as row,
  libraryCollectionHistoryRepositorySnapshot as snapshot,
  libraryCollectionHistoryRepositorySqlText as sqlText,
  libraryCollectionHistoryRepositoryState as state,
} from "./helpers/library-collection-history-repository-harness";

installLibraryCollectionHistoryRepositoryHooks();

it("reads immutable moves with both current own collection states and masked resource labels in one snapshot", async () => {
  state.rows = [
    ...prefix(),
    [row()],
    [
      ["lcol_dest", "Current destination", "archived", 9],
      ["lcol_source", "Current source", "active", 7],
    ],
    [
      { productId: "prd_a", title: "Accessible", available: true, storageKey: "PRIVATE" },
      { productId: "prd_b", title: "PRIVATE", available: false },
    ],
  ];
  const report = await readLibraryCollectionHistory("usr_a", query);
  expect(report.items[0]).toMatchObject({
    receipt: { collection: snapshot, sourceCollection: { id: "lcol_source", revision: 5 } },
    currentCollection: { name: "Current destination", revision: 9 },
    currentSource: { revision: 7 },
    resources: [
      { productId: "prd_a", currentTitle: "Accessible", currentAvailable: true },
      { productId: "prd_b", currentTitle: null, currentAvailable: false },
    ],
  });
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(sqlText()).toContain("transaction_timestamp()");
});
it("matches whole operations by own actor, time window, exact resource membership and either participating collection", async () => {
  state.rows = [...prefix(), [row()], [], []];
  const report = await readLibraryCollectionHistory("usr_a", {
    page: 9999,
    days: 365,
    action: "move-items",
    collectionId: "lcol_source",
    productId: "prd_a",
  });
  expect(report.items[0]?.resources).toHaveLength(2);
  expect(report.page).toBe(1);
  expect(sqlText()).toContain("@>");
  expect(sqlText()).toContain("sourceCollectionId");
  expect(sqlText()).toContain("<= transaction_timestamp()");
  const params = state.queries[2]?.params ?? [];
  expect(params).toContain("[" + '"prd_a"' + "]");
  expect(params).toContain("usr_a");
  expect(params).toContain("lcol_source");
  expect(params).toContain(365);
});
it("does not expand full-copy digests into invented resource history", async () => {
  const copy = {
    requestId,
    action: "duplicate",
    name: "Copy",
    sourceCollectionId: "lcol_source",
    expectedRevision: 4,
    expectedItemCount: 200,
    sourceDigest: "a".repeat(64),
  };
  state.rows = [...prefix(), [row(copy, { ...snapshot, name: "Copy", revision: 1 })], []];
  const report = await readLibraryCollectionHistory("usr_a", query);
  expect(report.items[0]?.receipt?.command).toEqual(copy);
  expect(report.items[0]?.resources).toEqual([]);
  expect(sqlText()).not.toContain("from refs");
});
it("matches either side of a reconciliation resource filter and returns the whole immutable operation", async () => {
  const proof = {
    requestId,
    action: "reconcile-items",
    expectedRevision: 1,
    addProductIds: ["prd_a"],
    removeProductIds: ["prd_b"],
  };
  state.rows = [...prefix(), [row(proof)], [], []];
  const report = await readLibraryCollectionHistory("usr_a", {
    ...query,
    action: "reconcile-items",
    productId: "prd_b",
  });
  expect(report.items[0]?.resources.map((resource) => resource.productId)).toEqual([
    "prd_a",
    "prd_b",
  ]);
  expect(sqlText()).toContain("removeProductIds");
  expect(sqlText()).toContain("addProductIds");
});
