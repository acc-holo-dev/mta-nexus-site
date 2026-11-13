import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../../site/packages/db/src/client", async () => {
  const { createLibraryCollectionsRepositoryDbMock } = await import(
    "../helpers/library-collections-repository-harness"
  );
  return createLibraryCollectionsRepositoryDbMock();
});

import { LibraryCollectionsRepository } from "../../site/packages/db/src/repositories/library-collections";
import {
  collection,
  collectionRow,
  input,
  insertedReceipt,
  prefix,
  requestId,
  resetLibraryCollectionsRepositoryState,
  sqlText,
  libraryCollectionsRepositoryState as state,
} from "../helpers/library-collections-repository-harness";

const repo = new LibraryCollectionsRepository();

beforeEach(() => {
  resetLibraryCollectionsRepositoryState();
});

it("adds only an acquired reference and rechecks the locked grant using database time", async () => {
  const command = { requestId, action: "add" as const, productId: "prd_a", expectedRevision: 1 },
    snapshot = { ...collection, revision: 2 };
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_a"]],
    [["ent_a", null]],
    [],
    [[0]],
    [{ valid: true }],
    [],
    [collectionRow(snapshot)],
    [insertedReceipt(command, snapshot)],
    [],
  ];
  expect(await repo.command(input(command))).toMatchObject({ receipt: { collection: snapshot } });
  expect(sqlText()).toContain('insert into "library_collection_items"');
  expect(sqlText()).not.toContain('insert into "entitlements"');
  expect(state.rows).toHaveLength(0);
});
it("rejects a grant that expires while waiting for locks", async () => {
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_a"]],
    [["ent_a", "2099-01-01T00:00:00Z"]],
    [],
    [[0]],
    [{ valid: false }],
  ];
  await expect(
    repo.command(input({ requestId, action: "add", productId: "prd_a", expectedRevision: 1 })),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(sqlText()).toContain("clock_timestamp()");
  expect(sqlText()).not.toContain('insert into "library_collection_items"');
});
it("rejects absent access and never treats membership as an entitlement", async () => {
  state.rows = [...prefix(), [collectionRow()], [[1]], [["prd_a"]], [], []];
  await expect(
    repo.command(input({ requestId, action: "add", productId: "prd_a", expectedRevision: 1 })),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(sqlText()).not.toContain('insert into "library_collection_items"');
});
it("allows removal after access is revoked without widening rights", async () => {
  const command = { requestId, action: "remove" as const, productId: "prd_a", expectedRevision: 1 },
    snapshot = { ...collection, revision: 2 };
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [],
    [collectionRow(snapshot)],
    [insertedReceipt(command, snapshot)],
    [],
  ];
  await repo.command(input(command));
  expect(sqlText()).toContain('delete from "library_collection_items"');
  expect(sqlText()).not.toContain('from "entitlements"');
});
