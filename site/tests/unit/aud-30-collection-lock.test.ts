import { beforeEach, expect, it, vi } from "vitest";
import { libraryCollectionCommandSchema } from "../../packages/validation/src/library-collections";

vi.mock("../../packages/db/src/client", async () => {
  const { createLibraryCollectionsRepositoryDbMock } = await import(
    "../helpers/library-collections-repository-harness"
  );
  return createLibraryCollectionsRepositoryDbMock();
});

import { LibraryCollectionsRepository } from "../../packages/db/src/repositories/library-collections";
import {
  collection,
  collectionRow,
  input,
  insertedReceipt,
  prefix,
  requestId,
  resetLibraryCollectionsRepositoryState,
  libraryCollectionsRepositoryState as state,
} from "../helpers/library-collections-repository-harness";

const repo = new LibraryCollectionsRepository();

beforeEach(() => {
  resetLibraryCollectionsRepositoryState();
});

const membershipLock = (sql: string) =>
  sql.includes('from "library_collection_items"') && /\bfor update\b/iu.test(sql);
const sessionLock = (sql: string) =>
  sql.includes('from "sessions"') && /\bfor update\b/iu.test(sql);

it("locks removal rows for update in productId order before the session, then deletes", async () => {
  const remove = { requestId, action: "remove" as const, productId: "prd_a", expectedRevision: 1 };
  const removed = { ...collection, revision: 2 };
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_a"]],
    [],
    [collectionRow(removed)],
    [insertedReceipt(remove, removed)],
    [],
  ];
  await repo.command(input(remove));
  const lock = state.queries.findIndex((query) => membershipLock(query.sql));
  const session = state.queries.findIndex((query) => sessionLock(query.sql));
  const deleted = state.queries.findIndex((query) =>
    query.sql.startsWith('delete from "library_collection_items"'),
  );
  expect(lock).toBeGreaterThanOrEqual(0);
  expect(session).toBeGreaterThan(lock);
  expect(deleted).toBeGreaterThan(session);
  expect(state.queries[lock]?.sql).toMatch(
    /order by "library_collection_items"\."product_id" asc for update/iu,
  );
  expect(state.queries[lock]?.sql).not.toMatch(/\bfor share\b/iu);
  expect(state.queries[lock]?.params).toEqual(["lcol_a", "prd_a"]);
  expect(state.rows).toHaveLength(0);

  const many = {
    requestId,
    action: "remove-many" as const,
    productIds: ["prd_c", "prd_a"],
    expectedRevision: 1,
  };
  state.queries = [];
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_a"], ["prd_c"]],
    [],
    [collectionRow(removed)],
    [insertedReceipt(many, removed)],
    [],
  ];
  await repo.command(input(many));
  const batchLock = state.queries.findIndex((query) => membershipLock(query.sql));
  const batchSession = state.queries.findIndex((query) => sessionLock(query.sql));
  const batchDelete = state.queries.findIndex((query) =>
    query.sql.startsWith('delete from "library_collection_items"'),
  );
  expect(batchLock).toBeGreaterThanOrEqual(0);
  expect(batchSession).toBeGreaterThan(batchLock);
  expect(batchDelete).toBeGreaterThan(batchSession);
  expect(state.queries[batchLock]?.sql).toMatch(
    /order by "library_collection_items"\."product_id" asc for update/iu,
  );
  expect(state.queries[batchLock]?.params).toEqual(["lcol_a", "prd_a", "prd_c"]);
  expect(state.queries.filter((query) => membershipLock(query.sql))).toHaveLength(1);
  expect(state.rows).toHaveLength(0);
});

it("keeps reconcile membership locks before the session and does not lock unrelated commands", async () => {
  const reconcile = libraryCollectionCommandSchema.parse({
    requestId,
    action: "reconcile-items",
    expectedRevision: 1,
    addProductIds: ["prd_new"],
    removeProductIds: ["prd_old"],
  });
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_old"]],
    [[200]],
    [["prd_new"]],
    [["ent_new", null]],
    [["prd_old"]],
    [],
    [collectionRow({ revision: 2 })],
    [insertedReceipt(reconcile, { ...collection, revision: 2 })],
    [],
    [{ valid: true }],
  ];
  await repo.command(input(reconcile));
  const shared = state.queries.findIndex(
    (query) =>
      query.sql.includes('from "library_collection_items"') && /\bfor share\b/iu.test(query.sql),
  );
  const session = state.queries.findIndex((query) => sessionLock(query.sql));
  expect(shared).toBeGreaterThanOrEqual(0);
  expect(session).toBeGreaterThan(shared);
  expect(state.queries[shared]?.sql).toMatch(
    /order by "library_collection_items"\."product_id" asc for share/iu,
  );
  expect(state.queries.some((query) => membershipLock(query.sql))).toBe(false);
  expect(state.rows).toHaveLength(0);

  const rename = { requestId, action: "rename" as const, name: "Next", expectedRevision: 1 };
  const renamed = { ...collection, revision: 2, name: "Next" };
  state.queries = [];
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [collectionRow(renamed)],
    [insertedReceipt(rename, renamed)],
    [],
  ];
  await repo.command(input(rename));
  expect(state.queries.some((query) => sessionLock(query.sql))).toBe(true);
  expect(state.queries.some((query) => query.sql.includes('from "library_collection_items"'))).toBe(
    false,
  );
  expect(state.rows).toHaveLength(0);
});
