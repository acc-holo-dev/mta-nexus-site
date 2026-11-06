import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryCollectionComparisonRepositoryDbMock } = await import(
    "./helpers/library-collection-comparison-repository-harness"
  );
  return createLibraryCollectionComparisonRepositoryDbMock();
});

import { readLibraryCollectionComparison } from "../packages/db/src/repositories/library-collection-comparison";
import {
  installLibraryCollectionComparisonRepositoryHooks,
  libraryCollectionComparisonRepositoryOwnedRows as ownedRows,
  libraryCollectionComparisonRepositoryPrefix as prefix,
  libraryCollectionComparisonRepositoryQuery as query,
  libraryCollectionComparisonRepositorySqlText as sqlText,
  libraryCollectionComparisonRepositoryState as state,
  libraryCollectionComparisonRepositorySummary as summary,
} from "./helpers/library-collection-comparison-repository-harness";

installLibraryCollectionComparisonRepositoryHooks();

it("rejects absent users and foreign source/destination before resource inspection", async () => {
  state.rows = [[]];
  await expect(readLibraryCollectionComparison("usr_a", "lcol_a", query)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
  state.queries = [];
  state.rows = [[["usr_a"]], ownedRows()];
  await expect(
    readLibraryCollectionComparison("usr_a", "lcol_foreign", query),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(2);
  state.queries = [];
  state.rows = [[["usr_a"]], ownedRows()];
  await expect(
    readLibraryCollectionComparison("usr_a", "lcol_a", { ...query, to: "lcol_foreign" }),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(2);
});
it.each(["source-only", "destination-only", "common", "unavailable"] as const)(
  "applies safe %s predicates and literal accessible-name search",
  async (filter) => {
    state.rows = [...prefix(), [{ ...summary, total: 0 }], []];
    await readLibraryCollectionComparison("usr_a", "lcol_a", { ...query, filter, q: "100%_\\" });
    expect(sqlText()).toContain("title ILIKE");
    expect(state.queries[3]?.params).toContain("%100\\%\\_\\\\%");
    expect(sqlText()).toContain(filter === "unavailable" ? "NOT available" : '"inSource"');
  },
);
it("rejects self-comparison, malformed direct arguments and impossible bounds", async () => {
  await expect(
    readLibraryCollectionComparison("usr_a", "lcol_a", { ...query, to: "lcol_a" }),
  ).rejects.toMatchObject({ statusCode: 400 });
  await expect(readLibraryCollectionComparison("usr_a", "../private", query)).rejects.toMatchObject(
    { statusCode: 400 },
  );
  expect(state.queries).toHaveLength(0);
  state.rows = [
    [["usr_a"]],
    Array.from({ length: 31 }, (_, i) => [`lcol_${i}`, "Name", "active", 1, 0]),
  ];
  await expect(readLibraryCollectionComparison("usr_a", "lcol_0", query)).rejects.toMatchObject({
    code: "COLLECTION_ITEM_LIMIT",
  });
  state.rows = [...prefix(), [{ ...summary, all: 401 }]];
  await expect(readLibraryCollectionComparison("usr_a", "lcol_a", query)).rejects.toMatchObject({
    code: "COLLECTION_ITEM_LIMIT",
  });
});
