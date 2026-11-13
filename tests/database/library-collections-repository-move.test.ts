import { describe, expect, it, vi } from "vitest";

vi.mock("../../site/packages/db/src/client", async () => {
  const { createLibraryCollectionsRepositoryDbMock } = await import(
    "../helpers/library-collections-repository-harness"
  );
  return createLibraryCollectionsRepositoryDbMock();
});

import { LibraryCollectionsRepository } from "../../site/packages/db/src/repositories/library-collections";
import {
  moveItems,
  movePrefix,
  moveSuccess,
  setupLibraryCollectionsRepositoryCopyMove,
} from "../helpers/library-collections-repository-copy-move-harness";
import {
  collection,
  collectionRow,
  input,
  insertedReceipt,
  record,
  recordRow,
  sqlText,
  libraryCollectionsRepositoryState as state,
} from "../helpers/library-collections-repository-harness";

const repo = new LibraryCollectionsRepository();

setupLibraryCollectionsRepositoryCopyMove();

describe("library collections repository: selected move", () => {
  it("moves only selected owned references atomically and proves the source successor in its receipt", async () => {
    moveSuccess();
    const result = await repo.command(input(moveItems));
    expect(result).toMatchObject({
      replayed: false,
      receipt: {
        command: moveItems,
        collection: { id: "lcol_a", revision: 2 },
        sourceCollection: { id: "lcol_source", revision: 5 },
      },
    });
    const writes = state.queries.filter((q) => q.sql.startsWith('update "library_collections"'));
    expect(writes).toHaveLength(2);
    expect(writes[0]?.params).toContain("lcol_source");
    expect(writes[1]?.params).toContain("lcol_a");
    const removal = state.queries.find((q) =>
      q.sql.startsWith('delete from "library_collection_items"'),
    );
    expect(removal?.params).toContain("lcol_source");
    expect(removal?.params).toContain("prd_a");
    expect(removal?.params).toContain("prd_b");
    expect(
      state.queries.find((query) => query.sql.startsWith('insert into "audit_events"'))?.params,
    ).toContain("library.collection_move-items");
    expect(state.queries.at(-1)?.sql).toContain('from "sessions"');
    expect(sqlText()).not.toMatch(
      /from "products"|entitlements|resource_library_selections|resource_release_watches/u,
    );
  });
  it.each([
    {
      index: 7,
      rows: [collectionRow({ id: "lcol_source", status: "archived", revision: 4 })],
      code: "COLLECTION_ARCHIVED",
    },
    { index: 8, rows: [[5000]], code: "COLLECTION_HISTORY_LIMIT" },
    { index: 9, rows: [["prd_a"]], code: "COLLECTION_CONFLICT" },
    { index: 11, rows: [[200]], code: "COLLECTION_ITEM_LIMIT" },
  ])(
    "rejects inactive/exhausted/stale/overflowed move scopes before changing either collection",
    async ({ index, rows, code }) => {
      state.rows = movePrefix();
      state.rows[index] = rows;
      await expect(repo.command(input(moveItems))).rejects.toMatchObject({ code });
      expect(sqlText()).not.toContain('delete from "library_collection_items"');
      expect(sqlText()).not.toContain('insert into "library_collection_items"');
    },
  );
  it("refuses a partial removal or failed source revision guard and propagates required audit failure", async () => {
    moveSuccess();
    state.rows[13] = [["prd_a"]];
    await expect(repo.command(input(moveItems))).rejects.toMatchObject({
      code: "COLLECTION_CONFLICT",
    });
    moveSuccess();
    state.rows[14] = [];
    await expect(repo.command(input(moveItems))).rejects.toMatchObject({
      code: "COLLECTION_CONFLICT",
    });
    moveSuccess();
    state.failAudit = true;
    await expect(repo.command(input(moveItems))).rejects.toMatchObject({
      cause: { message: "audit failed" },
    });
  });
  it("replays an immutable move receipt after later source changes without another deletion", async () => {
    state.rows = [
      [],
      [],
      [],
      [["usr_a"]],
      [recordRow(record(moveItems, { ...collection, revision: 2 }))],
      [collectionRow({ revision: 9 })],
    ];
    expect(await repo.command(input(moveItems))).toMatchObject({
      replayed: true,
      receipt: { sourceCollection: { id: "lcol_source", revision: 5 } },
    });
    expect(sqlText()).not.toMatch(/delete from|insert into|update /u);
  });
  it("reads the same own move receipt in source history with a literal partial-index predicate", async () => {
    state.rows = [
      [["usr_a"]],
      [collectionRow({ id: "lcol_source", revision: 7 })],
      [[1]],
      [insertedReceipt(moveItems, { ...collection, revision: 2 })],
    ];
    const history = await repo.history("usr_a", "lcol_source");
    expect(history.items[0]).toMatchObject({
      sourceCollection: { id: "lcol_source", revision: 5 },
      collection: { id: "lcol_a", revision: 2 },
    });
    expect(sqlText()).toContain(`->>'action'='move-items'`);
    expect(sqlText()).toContain(`->>'sourceCollectionId'=`);
    expect(state.queries[2]?.params).toContain("usr_a");
  });
});
