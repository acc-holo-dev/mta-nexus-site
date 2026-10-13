import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
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

import { readLibraryCollectionReceiptDetail } from "../packages/db/src/repositories/library-collection-receipt-detail";
import { libraryCollectionCommandSchema } from "../packages/validation/src/library-collections";
const date = "2026-10-13T00:00:00.000Z",
  requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89";
const command = libraryCollectionCommandSchema.parse({
  requestId,
  action: "reconcile-items",
  expectedRevision: 2,
  addProductIds: ["prd_added"],
  removeProductIds: ["prd_removed"],
});
const snapshot = { id: "lcol_a", name: "Recorded & name", status: "active", revision: 3 };
const row = (
  proof: unknown = command,
  digest = createHash("sha256").update(JSON.stringify(command)).digest("hex"),
) => ["lcr_a", requestId, "lcol_a", digest, proof, snapshot, date];
const prefix = () => [[["usr_a"]], [{ observedAt: date }]] as unknown[][];
const text = () => state.queries.map((q) => q.sql).join("\n");
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.options = [];
});
it("offers only exact inverse differences while retaining all unrelated current references", async () => {
  state.rows = [
    ...prefix(),
    [row()],
    [["lcol_a", "Later", "active", 9]],
    [["prd_added"], ["prd_later"]],
    [
      {
        productId: "prd_added",
        title: "PRIVATE",
        available: false,
        hasAccess: false,
        storageKey: "PRIVATE",
      },
      { productId: "prd_removed", title: "Accessible", available: true, hasAccess: true },
    ],
  ];
  const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
  expect(report.receipt?.collection).toEqual(snapshot);
  expect(report.currentCollection).toMatchObject({ name: "Later", revision: 9 });
  expect(report.resources).toEqual([
    {
      productId: "prd_added",
      currentTitle: null,
      currentAvailable: false,
      inCollection: true,
      restoreAction: "remove",
      status: "ready",
    },
    {
      productId: "prd_removed",
      currentTitle: "Accessible",
      currentAvailable: true,
      inCollection: false,
      restoreAction: "add",
      status: "ready",
    },
  ]);
  expect(report.restoration?.items).toEqual([
    {
      productId: "prd_added",
      title: null,
      available: false,
      inCollection: true,
      canAdd: false,
      canRemove: true,
    },
    {
      productId: "prd_later",
      title: null,
      available: false,
      inCollection: true,
      canAdd: false,
      canRemove: false,
    },
    {
      productId: "prd_removed",
      title: "Accessible",
      available: true,
      inCollection: false,
      canAdd: true,
      canRemove: false,
    },
  ]);
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(state.queries).toHaveLength(6);
  expect(state.queries[2]?.params).toEqual(["usr_a", "lcr_a", 1]);
  expect(state.queries[3]?.params).toContain("usr_a");
  expect(state.queries[4]?.params.at(-1)).toBe(201);
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(text()).toContain("transaction_timestamp()");
  expect(text()).toContain("'product.download'");
  expect(text()).toContain("'published'");
  expect(state.queries.at(-1)?.params).toContain("clean");
  expect(text()).not.toMatch(/insert into|update |delete from|for update/iu);
});
it("allows reviewing an inverse whose projected count exceeds capacity without proposing unrelated removals", async () => {
  const refs = Array.from({ length: 200 }, (_, i) => [`prd_unrelated_${i}`]);
  state.rows = [
    ...prefix(),
    [row()],
    [["lcol_a", "Current", "active", 9]],
    refs,
    [{ productId: "prd_removed", title: "Accessible", available: true, hasAccess: true }],
  ];
  const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
  expect(report.restoration?.itemCount).toBe(200);
  expect(report.restoration?.items.filter((item) => item.canAdd)).toHaveLength(1);
  expect(report.restoration?.items.filter((item) => item.canRemove)).toHaveLength(0);
  expect(report.resources[0]?.status).toBe("already-restored");
  expect(report.restoration?.items).toHaveLength(202);
});
it("marks restored references as already desired and masks lost-access restoration candidates", async () => {
  state.rows = [
    ...prefix(),
    [row()],
    [["lcol_a", "Current", "active", 9]],
    [],
    [{ productId: "prd_removed", title: "PRIVATE", available: false, hasAccess: false }],
  ];
  const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
  expect(report.resources.map((item) => item.status)).toEqual(["already-restored", "no-access"]);
  expect(report.restoration?.items.every((item) => !item.canAdd && !item.canRemove)).toBe(true);
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
});
it.each([
  ["archived", 9],
  ["active", 2147483647],
] as const)(
  "keeps archived/terminal proof readable without enabling changes: %s/%s",
  async (status, revision) => {
    state.rows = [
      ...prefix(),
      [row()],
      [["lcol_a", "Current", status, revision]],
      [["prd_added"]],
      [{ productId: "prd_removed", title: "Accessible", available: true, hasAccess: true }],
    ];
    const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
    expect(report.resources.every((item) => item.status === "read-only")).toBe(true);
    expect(report.restoration?.items.every((item) => !item.canAdd && !item.canRemove)).toBe(true);
  },
);
it.each(["digest", "hidden", "identity", "request", "future"])(
  "neutralizes malformed immutable proof before current metadata lookups: %s",
  async (kind) => {
    const proof = row();
    if (kind === "digest") proof[3] = "0".repeat(64);
    if (kind === "hidden") proof[4] = { ...command, storageKey: "PRIVATE" };
    if (kind === "identity") proof[5] = { ...snapshot, id: "lcol_foreign" };
    if (kind === "request") proof[1] = "77ca0352-de64-4af9-9e54-7d3c56fe8d89";
    if (kind === "future") proof[4] = { requestId, action: "future-action" };
    state.rows = [...prefix(), [proof]];
    const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
    expect(report).toMatchObject({
      receipt: null,
      currentCollection: null,
      restoration: null,
      resources: [],
    });
    expect(state.queries).toHaveLength(3);
    expect(JSON.stringify(report)).not.toContain("PRIVATE");
  },
);
it("does not invent reversible state for ordinary add/remove receipts with unknown prior membership", async () => {
  const proof = libraryCollectionCommandSchema.parse({
    requestId,
    action: "add",
    productId: "prd_a",
    expectedRevision: 2,
  });
  state.rows = [
    ...prefix(),
    [row(proof, createHash("sha256").update(JSON.stringify(proof)).digest("hex"))],
    [["lcol_a", "Current", "active", 9]],
  ];
  const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
  expect(report.receipt?.command).toEqual(proof);
  expect(report.restoration).toBeNull();
  expect(state.queries).toHaveLength(4);
});
it("rejects foreign/unknown receipt IDs and deleted actors before resource inspection", async () => {
  await expect(readLibraryCollectionReceiptDetail("usr_a", "../private")).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
  state.rows = [...prefix(), []];
  await expect(readLibraryCollectionReceiptDetail("usr_a", "lcr_foreign")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(3);
  state.queries = [];
  state.rows = [[]];
  await expect(readLibraryCollectionReceiptDetail("usr_deleted", "lcr_a")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
});
it("preserves proof with a missing current collection and rejects invalid snapshot time/count", async () => {
  state.rows = [...prefix(), [row()], []];
  expect((await readLibraryCollectionReceiptDetail("usr_a", "lcr_a")).receipt?.collection).toEqual(
    snapshot,
  );
  state.rows = [[["usr_a"]], [{ observedAt: "invalid" }]];
  await expect(readLibraryCollectionReceiptDetail("usr_a", "lcr_a")).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
  state.rows = [
    ...prefix(),
    [row()],
    [["lcol_a", "Current", "active", 9]],
    Array.from({ length: 201 }, (_, i) => [`prd_${i}`]),
  ];
  await expect(readLibraryCollectionReceiptDetail("usr_a", "lcr_a")).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
});
