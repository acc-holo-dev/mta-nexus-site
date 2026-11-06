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
  libraryCollectionHistoryRepositoryRow as row,
  libraryCollectionHistoryRepositorySnapshot as snapshot,
  libraryCollectionHistoryRepositoryState as state,
} from "./helpers/library-collection-history-repository-harness";

installLibraryCollectionHistoryRepositoryHooks();

it.each([
  { ...command, ownerId: "PRIVATE" },
  { ...command, action: "future-action" },
  { ...command, productIds: Array.from({ length: 21 }, (_, i) => `prd_${i}`) },
  { ...command, requestId: "7ca03522-de64-4af9-9e54-7d3c56fe8d89" },
])("projects invalid recorded proof neutrally without metadata lookups %o", async (cmd) => {
  state.rows = [...prefix(), [row(cmd)]];
  const report = await readLibraryCollectionHistory("usr_a", query);
  expect(report.items[0]).toEqual({
    id: "lcr_a",
    createdAt: date,
    receipt: null,
    currentCollection: null,
    currentSource: null,
    resources: [],
  });
  expect(state.queries).toHaveLength(4);
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
});
it("refuses snapshot/route identity or successor mismatches instead of inventing proof", async () => {
  for (const snap of [
    { ...snapshot, id: "lcol_other" },
    { ...snapshot, revision: 99 },
    { ...snapshot, status: "archived" },
  ]) {
    state.rows = [...prefix(), [row(command, snap)]];
    expect((await readLibraryCollectionHistory("usr_a", query)).items[0]?.receipt).toBeNull();
  }
});
it("requires a live user and rejects invalid direct selectors before any query", async () => {
  await expect(
    readLibraryCollectionHistory("usr_a", { ...query, page: 10000 }),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
  state.rows = [[]];
  await expect(readLibraryCollectionHistory("usr_deleted", query)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
});
it("rejects an invalid database clock and handles empty history without extra lookups", async () => {
  state.rows = [[["usr_a"]], [{ observedAt: "invalid" }]];
  await expect(readLibraryCollectionHistory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
  state.queries = [];
  state.rows = [[["usr_a"]], [{ observedAt: date }], [[0]], []];
  expect(await readLibraryCollectionHistory("usr_a", query)).toMatchObject({
    items: [],
    page: 1,
    totalPages: 1,
    total: 0,
  });
  expect(state.queries).toHaveLength(4);
});
