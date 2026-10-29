import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
  apply: vi.fn(),
  failAudit: false,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (sql.includes('from "sessions"')) return { rows: [["ses_a", "2099-01-01T00:00:00Z"]] };
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw Error("audit failed");
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

import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";

vi.mock("../packages/db/src/repositories/library-collection-command", async (original) => ({
  ...(await original<
    typeof import("../packages/db/src/repositories/library-collection-command")
  >()),
  prepareLibraryCollectionCommand: async (...args: unknown[]) => {
    const result = await state.apply(...args);
    return { replayed: result.replayed, write: async () => result };
  },
}));

import { applyLibraryMembershipBatch } from "../packages/db/src/repositories/library-membership-batches";
import { libraryMembershipBatchReceipts } from "../packages/db/src/schema";

const date = "2026-10-12T00:00:00.000Z",
  requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89",
  change = {
    collectionId: "lcol_a",
    expectedRevision: 2,
    wasInCollection: true,
    inCollection: false,
  };
const input = (changes = [change]) => ({
  userId: "usr_a",
  currentToken: "session_a",
  productId: "prd_a",
  command: { requestId, changes },
  receiptId: "lmb_a",
  auditId: "aud_parent",
  children: changes.map((c, i) => ({
    collectionId: c.collectionId,
    receiptId: `lcr_${i}`,
    auditId: `aud_${i}`,
  })),
});
const prefix = () => [[], [], [], [["usr_a"]], [], [[0]]] as unknown[][];
const sqlText = () => state.queries.map((q) => q.sql).join("\n");
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.options = [];
  state.failAudit = false;
  state.apply.mockReset();
  state.apply.mockImplementation(async (_tx, i) => ({
    replayed: false,
    receipt: {
      id: i.receiptId,
      requestId: i.command.requestId,
      command: i.command,
      collection: {
        id: i.collectionId,
        name: "Core",
        status: "active",
        revision: i.command.expectedRevision + 1,
      },
      createdAt: new Date(date),
    },
  }));
});
it("uses one owner-locked transaction for remove-only orphan changes and records one parent audit", async () => {
  state.rows = [...prefix(), [["lcol_a", "active", 2]], [["prd_a"]], [["lmb_a", date]], []];
  const result = await applyLibraryMembershipBatch(input());
  expect(result).toMatchObject({
    replayed: false,
    receipt: {
      productId: "prd_a",
      children: [
        {
          collection: { id: "lcol_a", revision: 3 },
          command: { action: "remove", productId: "prd_a" },
        },
      ],
    },
  });
  expect(state.apply).toHaveBeenCalledOnce();
  expect(state.options).toHaveLength(1);
  expect(sqlText()).toContain("pg_advisory_xact_lock");
  expect(sqlText()).not.toContain('from "products"');
  expect(sqlText()).not.toContain('from "entitlements"');
  expect(state.queries.at(-1)?.params).toContain("library.memberships_changed");
});
it("prechecks all reviewed revisions and memberships before applying any child", async () => {
  const second = { ...change, collectionId: "lcol_b" };
  state.rows = [...prefix(), [["lcol_a", "active", 2]], [["prd_a"]], [["lcol_b", "active", 9]]];
  await expect(applyLibraryMembershipBatch(input([second, change]))).rejects.toMatchObject({
    code: "COLLECTION_CONFLICT",
  });
  expect(state.apply).not.toHaveBeenCalled();
  expect(state.queries[6]?.params[0]).toBe("lcol_a");
});
it.each(["foreign", "archived", "changed-membership", "quota"])(
  "rejects %s group proof before mutation",
  async (kind) => {
    state.rows =
      kind === "quota"
        ? [...prefix().slice(0, 5), [[5000]]]
        : [
            ...prefix(),
            kind === "foreign" ? [] : [["lcol_a", kind === "archived" ? "archived" : "active", 2]],
            kind === "changed-membership" ? [] : [["prd_a"]],
          ];
    await expect(applyLibraryMembershipBatch(input())).rejects.toMatchObject({
      code:
        kind === "foreign"
          ? "NOT_FOUND"
          : kind === "archived"
            ? "COLLECTION_ARCHIVED"
            : kind === "quota"
              ? "COLLECTION_HISTORY_LIMIT"
              : "COLLECTION_CONFLICT",
    });
    expect(state.apply).not.toHaveBeenCalled();
  },
);
it("locks add access at database time and rejects expiry after all children instead of inserting a parent", async () => {
  const add = { ...change, wasInCollection: false, inCollection: true };
  state.rows = [
    ...prefix(),
    [["lcol_a", "active", 2]],
    [],
    [["prd_a"]],
    [["ent_a", date]],
    [{ valid: false }],
  ];
  await expect(applyLibraryMembershipBatch(input([add]))).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.apply).toHaveBeenCalledOnce();
  expect(sqlText()).toContain("clock_timestamp()");
  expect(sqlText()).not.toContain('insert into "library_membership_batch_receipts"');
});
it("rejects child replay and propagates required parent audit failure", async () => {
  state.rows = [...prefix(), [["lcol_a", "active", 2]], [["prd_a"]]];
  state.apply.mockResolvedValueOnce({ replayed: true, receipt: {} });
  await expect(applyLibraryMembershipBatch(input())).rejects.toMatchObject({
    code: "COLLECTION_REQUEST_REUSED",
  });
  state.rows = [...prefix(), [["lcol_a", "active", 2]], [["prd_a"]], [["lmb_a", date]], []];
  state.failAudit = true;
  await expect(applyLibraryMembershipBatch(input())).rejects.toThrow();
});
it("replays immutable child results after later edits without checking access or mutating", async () => {
  const i = input(),
    childUUID = "77ca0352-de64-4af9-9e54-7d3c56fe8d89",
    cmd = { requestId: childUUID, action: "remove", expectedRevision: 2, productId: "prd_a" };
  const record = {
    id: "lmb_a",
    userId: i.userId,
    requestId,
    productId: i.productId,
    commandDigest: createHash("sha256")
      .update(JSON.stringify({ productId: i.productId, command: i.command }))
      .digest("hex"),
    command: i.command,
    childReceiptIds: ["lcr_0"],
    createdAt: date,
  };
  state.rows = [
    [],
    [],
    [],
    [["usr_a"]],
    [
      Object.keys(getTableColumns(libraryMembershipBatchReceipts)).map(
        (k) => record[k as keyof typeof record],
      ),
    ],
    [
      [
        "lcr_0",
        childUUID,
        cmd,
        { id: "lcol_a", name: "Core", status: "active", revision: 3 },
        date,
      ],
    ],
  ];
  expect(await applyLibraryMembershipBatch(i)).toMatchObject({
    replayed: true,
    receipt: { children: [{ collection: { revision: 3 } }] },
  });
  expect(state.apply).not.toHaveBeenCalled();
  expect(sqlText()).not.toMatch(/insert into|update |delete from/iu);
  expect(sqlText()).toContain('"library_collections"."user_id"');
});
it("rejects invalid commands/identities before opening a transaction and binds replay to the resource", async () => {
  await expect(
    applyLibraryMembershipBatch(input([{ ...change, inCollection: true }])),
  ).rejects.toMatchObject({ statusCode: 400 });
  await expect(applyLibraryMembershipBatch({ ...input(), children: [] })).rejects.toMatchObject({
    code: "COLLECTION_BATCH_INVALID",
  });
  expect(state.queries).toHaveLength(0);
});

it("rejects using the same own parent UUID for another resource before accessing children", async () => {
  const record = {
    id: "lmb_a",
    userId: "usr_a",
    requestId,
    productId: "prd_other",
    commandDigest: "a".repeat(64),
    command: input().command,
    childReceiptIds: ["lcr_0"],
    createdAt: date,
  };
  state.rows = [
    [],
    [],
    [],
    [["usr_a"]],
    [
      Object.keys(getTableColumns(libraryMembershipBatchReceipts)).map(
        (k) => record[k as keyof typeof record],
      ),
    ],
  ];
  await expect(applyLibraryMembershipBatch(input())).rejects.toMatchObject({
    code: "COLLECTION_REQUEST_REUSED",
  });
  expect(state.apply).not.toHaveBeenCalled();
  expect(state.queries).toHaveLength(5);
});
