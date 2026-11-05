import { createHash } from "node:crypto";
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
  input,
  insertedReceipt,
  prefix,
  record,
  recordRow,
  requestId,
  resetLibraryCollectionsRepositoryState,
  sqlText,
  libraryCollectionsRepositoryState as state,
} from "./helpers/library-collections-repository-harness";

const repo = new LibraryCollectionsRepository();

const copyCommand = (
  source = { ...collection, id: "lcol_source" },
  productIds = ["prd_a", "prd_b"],
) => ({
  requestId,
  action: "duplicate" as const,
  name: "Copy",
  sourceCollectionId: source.id,
  expectedRevision: source.revision,
  expectedItemCount: productIds.length,
  sourceDigest: createHash("sha256")
    .update(JSON.stringify({ source, productIds: [...productIds].sort() }))
    .digest("hex"),
});

const copyItems = {
  requestId,
  action: "copy-items" as const,
  sourceCollectionId: "lcol_source",
  expectedSourceRevision: 4,
  productIds: ["prd_a", "prd_b"],
  expectedRevision: 1,
};
const copyPrefix = () =>
  [
    ...prefix(),
    [collectionRow()],
    [[0]],
    [collectionRow({ id: "lcol_source", name: "Archive", status: "archived", revision: 4 })],
    [["prd_a"], ["prd_b"]],
    [["prd_a"]],
    [[199]],
  ] as unknown[][];
const copySuccess = () => {
  state.rows = [
    ...copyPrefix(),
    [],
    [collectionRow({ revision: 2 })],
    [insertedReceipt(copyItems, { ...collection, revision: 2 })],
    [],
  ];
};

const moveItems = { ...copyItems, action: "move-items" as const };
const movePrefix = () => {
  const rows = copyPrefix();
  rows[7] = [collectionRow({ id: "lcol_source", name: "Source", status: "active", revision: 4 })];
  rows.splice(8, 0, [[0]]);
  return rows;
};
const moveSuccess = () => {
  state.rows = [
    ...movePrefix(),
    [],
    [["prd_a"], ["prd_b"]],
    [["lcol_source"]],
    [collectionRow({ revision: 2 })],
    [insertedReceipt(moveItems, { ...collection, revision: 2 })],
    [],
  ];
};

beforeEach(() => {
  resetLibraryCollectionsRepositoryState();
});

it("previews all owned references with a bounded snapshot and no resource metadata lookup", async () => {
  state.rows = [[["usr_a"]], [collectionRow()], [["prd_b"], ["prd_a"]]];
  const preview = await repo.copyPreview("usr_a", "lcol_a");
  expect(preview).toEqual({
    source: collection,
    itemCount: 2,
    sourceDigest: copyCommand(collection).sourceDigest,
  });
  expect(sqlText()).not.toMatch(/from "(?:products|entitlements|licenses|builds)"/u);
  expect(state.queries.at(-1)?.params).toEqual(["lcol_a", 201]);
  expect(state.options[0]).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
});
it.each(["active", "archived"] as const)(
  "creates an independent full copy from an %s source",
  async (status) => {
    const source = { ...collection, id: "lcol_source", status },
      command = copyCommand(source),
      snapshot = { ...collection, name: "Copy" };
    state.rows = [
      ...prefix(),
      [collectionRow(source)],
      [["prd_b"], ["prd_a"]],
      [[29]],
      [collectionRow(snapshot)],
      [],
      [insertedReceipt(command, snapshot)],
      [],
    ];
    const result = await repo.command(input(command));
    expect(result).toMatchObject({ replayed: false, receipt: { command, collection: snapshot } });
    expect(
      state.queries.find((q) => q.sql.includes('insert into "library_collection_items"'))?.params,
    ).toEqual(["lcol_a", "prd_a", "lcol_a", "prd_b"]);
    expect(sqlText()).toContain("for no key update");
    expect(sqlText()).not.toMatch(
      /update "library_collections"|from "(?:products|entitlements|licenses)"/u,
    );
    expect(state.rows).toHaveLength(0);
  },
);
it("copies an empty source without inserting members", async () => {
  const source = { ...collection, id: "lcol_source" },
    command = copyCommand(source, []),
    snapshot = { ...collection, name: "Copy" };
  state.rows = [
    ...prefix(),
    [collectionRow(source)],
    [],
    [[0]],
    [collectionRow(snapshot)],
    [insertedReceipt(command, snapshot)],
    [],
  ];
  await repo.command(input(command));
  expect(sqlText()).not.toContain('insert into "library_collection_items"');
  expect(state.rows).toHaveLength(0);
});
it("rejects changed source revision, name, state, count or exact composition before creating a target", async () => {
  const source = { ...collection, id: "lcol_source" },
    command = copyCommand(source);
  for (const [snapshot, ids] of [
    [{ ...source, revision: 2 }, ["prd_a", "prd_b"]],
    [{ ...source, name: "Other" }, ["prd_a", "prd_b"]],
    [{ ...source, status: "archived" }, ["prd_a", "prd_b"]],
    [source, ["prd_a"]],
    [source, ["prd_a", "prd_c"]],
  ] as const) {
    state.queries = [];
    state.rows = [...prefix(), [collectionRow(snapshot)], ids.map((id) => [id])];
    await expect(repo.command(input(command))).rejects.toMatchObject({
      code: "COLLECTION_CONFLICT",
    });
    expect(sqlText()).not.toContain("insert into");
  }
});
it("requires live source ownership and preserves the archive-inclusive collection quota", async () => {
  const command = copyCommand();
  state.rows = [...prefix(), []];
  await expect(repo.command(input(command))).rejects.toMatchObject({ statusCode: 404 });
  state.queries = [];
  state.rows = [
    ...prefix(),
    [collectionRow({ id: "lcol_source" })],
    [["prd_a"], ["prd_b"]],
    [[30]],
  ];
  await expect(repo.command(input(command))).rejects.toMatchObject({ code: "COLLECTION_LIMIT" });
  expect(sqlText()).not.toContain("insert into");
});
it("replays a copy by its immutable target receipt without rereading the changed source", async () => {
  const command = copyCommand(),
    snapshot = { ...collection, name: "Copy" };
  state.rows = [
    [],
    [],
    [],
    [["usr_a"]],
    [recordRow(record(command, snapshot))],
    [collectionRow({ status: "archived", revision: 3 })],
  ];
  expect(await repo.command(input(command))).toMatchObject({
    replayed: true,
    receipt: { collection: snapshot },
  });
  expect(state.queries.some((q) => q.params.includes("lcol_source"))).toBe(false);
  expect(sqlText()).not.toMatch(/insert into|update /u);
});
it("rejects copy commands sent to an update scope and target/source identity collision", async () => {
  const command = copyCommand();
  await expect(
    repo.command({ ...input(command), collectionId: "lcol_source" }),
  ).rejects.toMatchObject({ code: "COLLECTION_INVALID" });
  expect(state.queries).toHaveLength(0);
  state.rows = prefix();
  await expect(
    repo.command({ ...input(command), newCollectionId: "lcol_source" }),
  ).rejects.toMatchObject({ code: "COLLECTION_CONFLICT" });
  expect(sqlText()).not.toContain("insert into");
});
it("copies exact selected own references from an archived source without issuing access or changing existing entries", async () => {
  copySuccess();
  const result = await repo.command(input(copyItems));
  expect(result).toMatchObject({
    replayed: false,
    receipt: { command: copyItems, collection: { id: "lcol_a", revision: 2 } },
  });
  const insert = state.queries.find((q) =>
    q.sql.startsWith('insert into "library_collection_items"'),
  );
  expect(insert?.params).toContain("prd_b");
  expect(insert?.params).not.toContain("prd_a");
  const text = sqlText();
  expect(text).toContain("for share");
  expect(text).toContain("for no key update");
  expect(text).not.toMatch(
    /(?:from "products"|entitlements|licenses|resource_library_selections|resource_release_watches)/u,
  );
  const audit = state.queries.find((query) => query.sql.startsWith('insert into "audit_events"'));
  expect(audit?.params).toContain("library.collection_copy-items");
  expect(audit?.params.some((p) => typeof p === "string" && p.includes('"sourceRevision":4'))).toBe(
    true,
  );
  expect(state.queries.at(-1)?.sql).toContain('from "sessions"');
});
it.each([
  { index: 7, rows: [] },
  { index: 7, rows: [collectionRow({ id: "lcol_source", revision: 5 })] },
  { index: 8, rows: [["prd_a"]] },
  { index: 10, rows: [[200]] },
])(
  "rejects foreign/stale/missing source evidence or destination overflow before copying",
  async ({ index, rows }) => {
    state.rows = copyPrefix();
    state.rows[index] = rows;
    await expect(repo.command(input(copyItems))).rejects.toMatchObject({
      statusCode: index === 7 && rows.length === 0 ? 404 : 409,
    });
    expect(sqlText()).not.toContain('insert into "library_collection_items"');
  },
);
it("replays the immutable selected-copy receipt without requiring unchanged current source or target revisions", async () => {
  state.rows = [
    [],
    [],
    [],
    [["usr_a"]],
    [recordRow(record(copyItems, { ...collection, revision: 2 }))],
    [collectionRow({ revision: 9 })],
  ];
  expect(await repo.command(input(copyItems))).toMatchObject({
    replayed: true,
    receipt: { collection: { revision: 2 } },
  });
  expect(sqlText()).not.toContain("insert into");
  expect(sqlText()).not.toContain("library_collection_items");
});
it("rolls selected copying back if the required audit cannot be written", async () => {
  copySuccess();
  state.failAudit = true;
  await expect(repo.command(input(copyItems))).rejects.toMatchObject({
    cause: { message: "audit failed" },
  });
});
it("projects only own reference IDs, masked names and bounded destination membership in one snapshot", async () => {
  state.rows = [
    [["usr_a"]],
    [collectionRow({ status: "archived" })],
    [{ total: 1, ready: 0 }],
    [
      {
        productId: "prd_a",
        hasAccess: false,
        title: "PRIVATE-TITLE",
        buildId: "PRIVATE-BUILD",
        storageKey: "PRIVATE-STORAGE",
      },
    ],
    [[...collectionRow({ id: "lcol_b", name: "Target" }), 199]],
    [["lcol_b", "prd_a"]],
  ];
  const result = await repo.copyItemsPage("usr_a", "lcol_a", 1, "Core");
  expect(result).toMatchObject({
    source: { id: "lcol_a", status: "archived" },
    items: [{ productId: "prd_a", title: null }],
    destinations: [{ id: "lcol_b", itemCount: 199, presentProductIds: ["prd_a"] }],
  });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(state.queries).toHaveLength(6);
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(sqlText()).toContain("transaction_timestamp()");
  expect(sqlText()).not.toContain("for share");
});
it("rejects direct invalid copy-item pages before issuing a query", async () => {
  await expect(repo.copyItemsPage("usr_a", "../private", 1, "")).rejects.toMatchObject({
    code: "COLLECTION_INVALID",
  });
  await expect(repo.copyItemsPage("usr_a", "lcol_a", 10000, "")).rejects.toMatchObject({
    code: "COLLECTION_INVALID",
  });
  expect(state.queries).toHaveLength(0);
});
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
