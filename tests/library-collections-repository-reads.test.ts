import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryCollectionsRepositoryDbMock } = await import(
    "./helpers/library-collections-repository-harness"
  );
  return createLibraryCollectionsRepositoryDbMock();
});

import { LibraryCollectionsRepository } from "../packages/db/src/repositories/library-collections";
import {
  collection,
  collectionRow,
  date,
  resetLibraryCollectionsRepositoryState,
  sqlText,
  libraryCollectionsRepositoryState as state,
} from "./helpers/library-collections-repository-harness";

const repo = new LibraryCollectionsRepository();

beforeEach(() => {
  resetLibraryCollectionsRepositoryState();
});

it("reads only owned collections in a consistent bounded snapshot", async () => {
  state.rows = [[["usr_a"]], [[1]], [[...collectionRow(), 3]]];
  expect(await repo.page("usr_a", 999)).toMatchObject({
    page: 1,
    pageSize: 20,
    total: 1,
    items: [{ ...collection, itemCount: 3 }],
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(sqlText()).toContain('"library_collections"."user_id" = $1');
});
it("masks titles after lost access and preserves exact safe pinned build gates in SQL", async () => {
  state.rows = [
    [["usr_a"]],
    [collectionRow()],
    [{ total: 1, ready: 0 }],
    [
      {
        productId: "prd_a",
        addedAt: new Date(date),
        title: null,
        slug: null,
        version: null,
        buildId: null,
        downloadable: false,
        hasAccess: false,
        inCollection: true,
      },
    ],
  ];
  const result = await repo.detail("usr_a", "lcol_a", 1, "100%_\\");
  expect(result.items[0]).toMatchObject({ title: null, downloadable: false, hasAccess: false });
  expect(sqlText()).toContain("owned.resource_id IS NOT NULL");
  expect(sqlText()).toContain("pref.mode='fixed'");
  expect(sqlText()).toContain("scanner");
  expect(state.queries.at(-1)?.params).toContain("%100\\%\\_\\\\%");
  expect(state.options[0]).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
});
it("keeps candidate scope restricted to existing effective access", async () => {
  state.rows = [[["usr_a"]], [collectionRow()], [{ total: 0, ready: 0 }], []];
  await repo.detail("usr_a", "lcol_a", 1, "", true);
  expect(sqlText()).toContain('FROM owned JOIN "products" product');
  expect(sqlText()).not.toContain("license_key");
});
it("reads collection releases and full count in one private database-clock snapshot", async () => {
  state.rows = [
    [["usr_a"]],
    [collectionRow()],
    [{ observedAt: date, itemCount: 200 }],
    [{ all: 41, updates: 21, pinned: 22, unavailable: 10 }],
    [
      {
        productId: "prd_a",
        hasAccess: true,
        state: "update_available",
        title: "Core",
        mode: "fixed",
        latestBuildId: "bld_latest",
        selectedBuildId: "bld_fixed",
      },
    ],
  ];
  const result = await repo.releases("usr_a", "lcol_a", 999, "updates", "100%_\\");
  expect(result).toMatchObject({
    schemaVersion: 1,
    generatedAt: date,
    itemCount: 200,
    collection,
    page: 2,
    filter: "updates",
    q: "100%_\\",
    total: 21,
    counts: { all: 41 },
    items: [{ state: "update_available" }],
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries).toHaveLength(5);
  expect(sqlText()).toContain("transaction_timestamp()");
  expect(sqlText()).toContain("member.collection_id=");
  expect(sqlText()).toContain("owned.resource_id IS NOT NULL");
  expect(sqlText()).toContain("selected.id <> latest.id");
  expect(state.queries.at(-1)?.params).toContain("%100\\%\\_\\\\%");
  expect(state.queries.at(-1)?.params.slice(-2)).toEqual([20, 20]);
  expect(sqlText()).not.toMatch(/storage_key|license_key|insert into|update /u);
});
it("preserves masked lost-access references and inspects archived collections without mutations", async () => {
  state.rows = [
    [["usr_a"]],
    [collectionRow({ status: "archived" })],
    [{ observedAt: date, itemCount: 1 }],
    [{ all: 1, unavailable: 1, pinned: 1, updates: 0 }],
    [
      {
        productId: "prd_lost",
        title: null,
        hasAccess: false,
        latestBuildId: null,
        selectedBuildId: null,
        state: "unavailable",
        mode: "fixed",
      },
    ],
  ];
  expect(await repo.releases("usr_a", "lcol_a", 1, "unavailable")).toMatchObject({
    collection: { status: "archived" },
    items: [{ title: null, hasAccess: false }],
  });
  expect(sqlText()).toContain("LEFT JOIN owned ON owned.resource_id=refs.resource_id");
  expect(sqlText()).toContain("owned.resource_id IS NULL");
  expect(sqlText()).toContain("scanner");
});
it("checks current account and owner before querying release metadata", async () => {
  state.rows = [[]];
  await expect(repo.releases("usr_a", "lcol_a")).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(1);
  state.queries = [];
  state.rows = [[["usr_a"]], []];
  await expect(repo.releases("usr_a", "lcol_a")).rejects.toMatchObject({ statusCode: 404 });
  expect(sqlText()).not.toContain('from "builds"');
});
it("rejects invalid release requests before opening a transaction", async () => {
  await expect(repo.releases("usr_a", "../other")).rejects.toMatchObject({
    code: "COLLECTION_INVALID",
  });
  await expect(repo.releases("usr_a", "lcol_a", 0)).rejects.toMatchObject({
    code: "COLLECTION_INVALID",
  });
  await expect(repo.releases("usr_a", "lcol_a", 1, "all", "\u0000")).rejects.toMatchObject({
    code: "COLLECTION_INVALID",
  });
  expect(state.queries).toHaveLength(0);
});
