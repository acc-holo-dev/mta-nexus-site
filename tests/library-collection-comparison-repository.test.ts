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
  libraryCollectionComparisonRepositoryDate as date,
  libraryCollectionComparisonRepositoryPrefix as prefix,
  libraryCollectionComparisonRepositoryQuery as query,
  libraryCollectionComparisonRepositorySqlText as sqlText,
  libraryCollectionComparisonRepositoryState as state,
  libraryCollectionComparisonRepositorySummary as summary,
} from "./helpers/library-collection-comparison-repository-harness";

installLibraryCollectionComparisonRepositoryHooks();

it("compares bounded own reference sets in one database-time snapshot and strips hidden metadata", async () => {
  state.rows = [
    ...prefix(),
    [summary],
    [
      {
        productId: "prd_a",
        title: "Accessible",
        available: true,
        inSource: true,
        inDestination: false,
        storageKey: "PRIVATE",
      },
      {
        productId: "prd_common",
        title: "PRIVATE",
        available: false,
        inSource: true,
        inDestination: true,
      },
      {
        productId: "prd_destination",
        title: null,
        available: false,
        inSource: false,
        inDestination: true,
      },
    ],
  ];
  const report = await readLibraryCollectionComparison("usr_a", "lcol_a", query);
  expect(report.source).toEqual({
    id: "lcol_a",
    name: "Source & name",
    status: "archived",
    revision: 4,
    itemCount: 2,
  });
  expect(report.targets).toHaveLength(1);
  expect(report.comparison).toMatchObject({
    destination: { id: "lcol_b", revision: 2 },
    counts: { all: 3, common: 1 },
    pageSize: 20,
    total: 3,
    items: [
      {
        productId: "prd_a",
        title: "Accessible",
        available: true,
        inSource: true,
        inDestination: false,
      },
      {
        productId: "prd_common",
        title: null,
        available: false,
        inSource: true,
        inDestination: true,
      },
      {
        productId: "prd_destination",
        title: null,
        available: false,
        inSource: false,
        inDestination: true,
      },
    ],
  });
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries[1]?.params).toContain("usr_a");
  expect(state.queries[1]?.params.at(-1)).toBe(31);
  expect(state.queries[4]?.params).toContain(20);
  expect(sqlText()).toContain("bool_or");
  expect(sqlText()).toContain("transaction_timestamp()");
  expect(state.queries[4]?.params).toContain("clean");
  expect(sqlText()).not.toMatch(/insert into|delete from|update |for update/iu);
});
it("chooses from own archived and active targets without accessing product metadata", async () => {
  state.rows = prefix();
  const report = await readLibraryCollectionComparison("usr_a", "lcol_a", {
    page: 1,
    filter: "all",
    q: "",
    transfer: "move",
  });
  expect(report.comparison).toBeNull();
  expect(report.targets[0]?.id).toBe("lcol_b");
  expect(state.queries).toHaveLength(3);
  expect(sqlText()).not.toContain('"products"');
});
