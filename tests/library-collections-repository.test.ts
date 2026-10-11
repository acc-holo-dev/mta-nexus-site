import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            state.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { LibraryCollectionsRepository } from "../packages/db/src/repositories/library-collections";
import { libraryCollectionReceipts } from "../packages/db/src/schema";
import type {
  LibraryCollectionCommand,
  LibraryCollectionSnapshot,
} from "../packages/domain/src/library-collections";

const repo = new LibraryCollectionsRepository(),
  date = "2026-10-11T00:00:00.000Z",
  requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89";
const collection: LibraryCollectionSnapshot = {
    id: "lcol_a",
    name: "Core",
    status: "active" as const,
    revision: 1,
  },
  create = { requestId, action: "create" as const, name: "Core" };
const collectionRow = (v: Record<string, unknown> = {}) => {
  const c = { ...collection, ...v };
  return [c.id, c.name, c.status, c.revision, date, date];
};
const record = (command: LibraryCollectionCommand, snapshot = collection) => ({
  id: "lcr_a",
  userId: "usr_a",
  requestId,
  collectionId: collection.id,
  commandDigest: createHash("sha256").update(JSON.stringify(command)).digest("hex"),
  command,
  snapshot,
  createdAt: date,
});
const recordRow = (r: ReturnType<typeof record>) =>
  Object.keys(getTableColumns(libraryCollectionReceipts)).map((k) => r[k as keyof typeof r]);
const insertedReceipt = (command: LibraryCollectionCommand, snapshot = collection) => [
  "lcr_a",
  requestId,
  command,
  snapshot,
  date,
];
const input = (command: LibraryCollectionCommand = create) => ({
  userId: "usr_a",
  command,
  ...(command.action === "create" ? {} : { collectionId: "lcol_a" }),
  newCollectionId: "lcol_a",
  receiptId: "lcr_a",
  auditId: "aud_a",
});
const prefix = () => [[], [], [], [["usr_a"]], []] as unknown[][];
const sqlText = () => state.queries.map((q) => q.sql).join("\n");
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
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
it("validates direct repository commands without opening a transaction", async () => {
  await expect(
    repo.command({
      ...input(),
      command: { ...create, userId: "other" } as LibraryCollectionCommand,
    }),
  ).rejects.toMatchObject({ code: "COLLECTION_INVALID" });
  expect(state.queries).toHaveLength(0);
});
