import { beforeEach, expect, it, vi } from "vitest";
import type { LibraryCollectionCommand } from "../../site/packages/domain/src/library-collections";

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
  create,
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

it("creates one collection, immutable receipt and atomic audit with owner quota lock", async () => {
  state.rows = [...prefix(), [[0]], [collectionRow()], [insertedReceipt(create)], []];
  expect(await repo.command(input())).toMatchObject({
    replayed: false,
    receipt: { collection, command: create },
  });
  expect(state.queries[2]?.params).toContain("library-collections:usr_a");
  expect(sqlText()).toContain('insert into "library_collections"');
  expect(sqlText()).toContain('insert into "library_collection_receipts"');
  expect(sqlText()).toContain('insert into "audit_events"');
  expect(sqlText()).not.toMatch(/insert into "(?:entitlements|licenses|payments|ledger_entries)"/u);
  expect(state.rows).toHaveLength(0);
});
it("replays committed creation after response loss without duplicate writes", async () => {
  state.rows = [[], [], [], [["usr_a"]], [recordRow(record(create))], [collectionRow()]];
  expect(await repo.command(input())).toMatchObject({ replayed: true, receipt: { collection } });
  expect(sqlText()).not.toContain("insert into");
});
it("forbids UUID reuse with changed command or collection", async () => {
  const rename = { requestId, action: "rename" as const, name: "Other", expectedRevision: 1 };
  state.rows = [[], [], [], [["usr_a"]], [recordRow(record(create))]];
  await expect(repo.command(input(rename))).rejects.toMatchObject({
    code: "COLLECTION_REQUEST_REUSED",
  });
  expect(sqlText()).not.toContain("update ");
});
it.each(["create", "rename"] as const)(
  "requires a live owner for %s even on replay",
  async (action) => {
    state.rows = [[], [], [], []];
    await expect(
      repo.command(
        input(
          action === "create" ? create : { requestId, action, name: "Core", expectedRevision: 1 },
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(sqlText()).not.toContain('from "library_collection_receipts"');
  },
);
it("rejects another owner's collection before mutation or grant inspection", async () => {
  state.rows = [...prefix(), []];
  await expect(
    repo.command(input({ requestId, action: "add", productId: "prd_a", expectedRevision: 1 })),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries.at(-1)?.params).toEqual(["lcol_a", "usr_a", 1]);
  expect(sqlText()).not.toContain('from "entitlements"');
});
it("checks revisions and history quota before writing", async () => {
  state.rows = [...prefix(), [collectionRow({ revision: 2 })]];
  await expect(
    repo.command(input({ requestId, action: "archive", expectedRevision: 1 })),
  ).rejects.toMatchObject({ code: "COLLECTION_CONFLICT" });
  state.queries = [];
  state.rows = [...prefix(), [collectionRow()], [[5000]]];
  await expect(
    repo.command(input({ requestId, action: "archive", expectedRevision: 1 })),
  ).rejects.toMatchObject({ code: "COLLECTION_HISTORY_LIMIT" });
  expect(sqlText()).not.toContain('update "library_collections"');
});
it.each(["rename", "add", "remove", "archive"] as const)(
  "forbids %s in archived collection",
  async (action) => {
    state.rows = [...prefix(), [collectionRow({ status: "archived" })], [[1]]];
    const command = {
      requestId,
      action,
      expectedRevision: 1,
      ...(action === "rename" ? { name: "Core" } : {}),
      ...(action === "add" || action === "remove" ? { productId: "prd_a" } : {}),
    } as LibraryCollectionCommand;
    await expect(repo.command(input(command))).rejects.toMatchObject({
      code: "COLLECTION_ARCHIVED",
    });
    expect(sqlText()).not.toContain('from "products"');
  },
);
it.each(["archive", "restore", "rename"] as const)(
  "commits %s with one successor revision and private receipt",
  async (action) => {
    const command = {
      requestId,
      action,
      expectedRevision: 1,
      ...(action === "rename" ? { name: "Next" } : {}),
    } as LibraryCollectionCommand;
    const snapshot = {
      ...collection,
      revision: 2,
      name: action === "rename" ? "Next" : "Core",
      status: action === "archive" ? ("archived" as const) : ("active" as const),
    };
    state.rows = [
      ...prefix(),
      [collectionRow({ status: action === "restore" ? "archived" : "active" })],
      [[1]],
      [collectionRow(snapshot)],
      [insertedReceipt(command, snapshot)],
      [],
    ];
    expect(await repo.command(input(command))).toMatchObject({
      receipt: { collection: snapshot },
      replayed: false,
    });
    expect(sqlText()).not.toMatch(/update "(?:entitlements|licenses|products)"/u);
    expect(state.rows).toHaveLength(0);
  },
);
it("enforces collection and item quotas before inserts", async () => {
  state.rows = [...prefix(), [[30]]];
  await expect(repo.command(input())).rejects.toMatchObject({ code: "COLLECTION_LIMIT" });
  state.queries = [];
  state.rows = [...prefix(), [collectionRow()], [[1]], [["prd_a"]], [["ent_a", null]], [], [[200]]];
  await expect(
    repo.command(input({ requestId, action: "add", productId: "prd_a", expectedRevision: 1 })),
  ).rejects.toMatchObject({ code: "COLLECTION_ITEM_LIMIT" });
  expect(sqlText()).not.toContain('insert into "library_collection_items"');
});
it("validates direct repository commands without opening a transaction", async () => {
  await expect(
    repo.command({
      ...input(),
      command: { ...create, userId: "other" } as LibraryCollectionCommand,
    }),
  ).rejects.toMatchObject({ code: "COLLECTION_INVALID" });
  expect(state.queries).toHaveLength(0);
});
