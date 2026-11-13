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
  record,
  recordRow,
  requestId,
  resetLibraryCollectionsRepositoryState,
  sqlText,
  libraryCollectionsRepositoryState as state,
} from "../helpers/library-collections-repository-harness";

const repo = new LibraryCollectionsRepository();

beforeEach(() => {
  resetLibraryCollectionsRepositoryState();
});

it("locks every batch resource and grant before one insert, revision, receipt and audit", async () => {
  const command = {
      requestId,
      action: "add-many" as const,
      productIds: ["prd_a", "prd_b"],
      expectedRevision: 1,
    },
    snapshot = { ...collection, revision: 2 };
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_a"]],
    [["ent_a", null]],
    [["prd_b"]],
    [["ent_b", null]],
    [],
    [[198]],
    [{ valid: true }],
    [],
    [collectionRow(snapshot)],
    [insertedReceipt(command, snapshot)],
    [],
  ];
  expect(await repo.command(input({ ...command, productIds: ["prd_b", "prd_a"] }))).toMatchObject({
    receipt: { command, collection: snapshot },
  });
  const insert = state.queries.filter((q) =>
    q.sql.includes('insert into "library_collection_items"'),
  );
  expect(insert).toHaveLength(1);
  expect(insert[0]?.params).toEqual(["lcol_a", "prd_a", "lcol_a", "prd_b"]);
  const audit = state.queries.find((q) => q.sql.includes('insert into "audit_events"'));
  expect(audit?.params).toContain("library.collection_add-many");
  expect(state.rows).toHaveLength(0);
});
it("accounts for already present references when checking a full collection", async () => {
  const command = {
      requestId,
      action: "add-many" as const,
      productIds: ["prd_a", "prd_b"],
      expectedRevision: 1,
    },
    snapshot = { ...collection, revision: 2 };
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_a"]],
    [["ent_a", null]],
    [["prd_b"]],
    [["ent_b", null]],
    [["prd_a"], ["prd_b"]],
    [[200]],
    [{ valid: true }],
    [collectionRow(snapshot)],
    [insertedReceipt(command, snapshot)],
    [],
  ];
  await repo.command(input(command));
  expect(sqlText()).not.toContain('insert into "library_collection_items"');
  expect(state.rows).toHaveLength(0);
});
it("rejects the entire batch when the aggregate item quota would overflow", async () => {
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_a"]],
    [["ent_a", null]],
    [["prd_b"]],
    [["ent_b", null]],
    [],
    [[199]],
  ];
  await expect(
    repo.command(
      input({ requestId, action: "add-many", productIds: ["prd_a", "prd_b"], expectedRevision: 1 }),
    ),
  ).rejects.toMatchObject({ code: "COLLECTION_ITEM_LIMIT" });
  expect(sqlText()).not.toContain('insert into "library_collection_items"');
  expect(sqlText()).not.toContain('update "library_collections"');
});
it("rejects all references if one acquired right is missing or expires after locks", async () => {
  const command = {
    requestId,
    action: "add-many" as const,
    productIds: ["prd_a", "prd_b"],
    expectedRevision: 1,
  };
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_a"]],
    [["ent_a", null]],
    [["prd_b"]],
    [],
    [],
  ];
  await expect(repo.command(input(command))).rejects.toMatchObject({ statusCode: 404 });
  expect(sqlText()).not.toContain('insert into "library_collection_items"');
  state.queries = [];
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_a"]],
    [["ent_a", "2099-01-01T00:00:00Z"]],
    [["prd_b"]],
    [["ent_b", null]],
    [],
    [[0]],
    [{ valid: false }],
  ];
  await expect(repo.command(input(command))).rejects.toMatchObject({
    code: "COLLECTION_ACCESS_CHANGED",
  });
  expect(sqlText()).toContain("clock_timestamp()");
  expect(sqlText()).not.toContain('insert into "library_collection_items"');
});
it("removes a batch without grants and replays the canonical receipt after revocation", async () => {
  const command = {
      requestId,
      action: "remove-many" as const,
      productIds: ["prd_a", "prd_b"],
      expectedRevision: 1,
    },
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
  expect(
    state.queries.filter((q) => q.sql.includes('delete from "library_collection_items"')),
  ).toHaveLength(1);
  expect(sqlText()).not.toContain('from "entitlements"');
  state.queries = [];
  state.rows = [
    [],
    [],
    [],
    [["usr_a"]],
    [recordRow(record(command, snapshot))],
    [collectionRow({ status: "archived", revision: 3 })],
  ];
  expect(await repo.command(input({ ...command, productIds: ["prd_b", "prd_a"] }))).toMatchObject({
    replayed: true,
    receipt: { collection: snapshot },
  });
  expect(sqlText()).not.toMatch(/insert into|delete from|update /u);
});
