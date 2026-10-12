import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
  failAudit: false,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failed");
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
  ...(command.action === "create" || command.action === "duplicate"
    ? {}
    : { collectionId: "lcol_a" }),
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
  state.failAudit = false;
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
  expect(state.queries.at(-1)?.params).toContain("library.collection_copy-items");
  expect(
    state.queries
      .at(-1)
      ?.params.some((p) => typeof p === "string" && p.includes('"sourceRevision":4')),
  ).toBe(true);
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
  expect(state.queries.at(-1)?.params).toContain("library.collection_move-items");
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
