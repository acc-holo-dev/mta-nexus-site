import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryCollectionsRepositoryDbMock } = await import(
    "./helpers/library-collections-repository-harness"
  );
  return createLibraryCollectionsRepositoryDbMock();
});

import { LibraryCollectionsRepository } from "../packages/db/src/repositories/library-collections";
import {
  date,
  resetLibraryCollectionsRepositoryState,
  sqlText,
  libraryCollectionsRepositoryState as state,
} from "./helpers/library-collections-repository-harness";

const repo = new LibraryCollectionsRepository();

beforeEach(() => {
  resetLibraryCollectionsRepositoryState();
});

it("reads bounded own resource memberships in one read-only snapshot with database-time access", async () => {
  state.rows = [
    [["usr_a"]],
    [
      {
        productId: "prd_a",
        title: "Safe resource",
        available: true,
        canAdd: true,
        generatedAt: date,
      },
    ],
    [
      ["lcol_a", "Core", "active", 4, 200, true],
      ["lcol_archive", "Archive", "archived", 3, 2, false],
    ],
  ];
  const report = await repo.resourceMemberships("usr_a", "prd_a");
  expect(report).toEqual({
    schemaVersion: 1,
    generatedAt: date,
    resource: { productId: "prd_a", title: "Safe resource", available: true, canAdd: true },
    collections: [
      {
        id: "lcol_a",
        name: "Core",
        status: "active",
        revision: 4,
        itemCount: 200,
        inCollection: true,
      },
      {
        id: "lcol_archive",
        name: "Archive",
        status: "archived",
        revision: 3,
        itemCount: 2,
        inCollection: false,
      },
    ],
    collectionLimit: 30,
    itemLimit: 200,
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(sqlText()).toContain("transaction_timestamp()");
  expect(sqlText()).toContain("collection.user_id=");
  expect(sqlText()).toContain("member.product_id=requested.id");
  expect(sqlText()).toContain("left(title,200)");
  expect(state.queries.at(-1)?.params).toContain("usr_a");
  expect(state.queries.at(-1)?.params.at(-1)).toBe(31);
  expect(sqlText()).not.toMatch(/insert into|update |delete from|for update/iu);
});
it.each([false, true])(
  "masks unavailable metadata independently of add access %s",
  async (canAdd) => {
    state.rows = [
      [["usr_a"]],
      [{ productId: "prd_a", title: "hidden", available: false, canAdd, generatedAt: date }],
      [["lcol_a", "Core", "active", 4, 1, true]],
    ];
    expect((await repo.resourceMemberships("usr_a", "prd_a")).resource).toEqual({
      productId: "prd_a",
      title: null,
      available: false,
      canAdd,
    });
  },
);
it("does not inspect memberships without live ownership scope", async () => {
  state.rows = [[]];
  await expect(repo.resourceMemberships("usr_missing", "prd_a")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
  state.queries = [];
  state.rows = [[["usr_a"]], []];
  await expect(repo.resourceMemberships("usr_a", "prd_foreign")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(2);
});
it("fails closed on more than thirty own collections or invalid resource ids", async () => {
  await expect(repo.resourceMemberships("usr_a", "../private")).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
  state.rows = [
    [["usr_a"]],
    [{ productId: "prd_a", title: null, available: false, canAdd: false, generatedAt: date }],
    Array.from({ length: 31 }, (_, i) => [`lcol_${i}`, "Core", "active", 1, 1, true]),
  ];
  await expect(repo.resourceMemberships("usr_a", "prd_a")).rejects.toMatchObject({
    code: "COLLECTION_LIMIT",
  });
});
