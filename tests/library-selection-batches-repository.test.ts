import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
  access: vi.fn(),
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
vi.mock("../packages/db/src/repositories/entitlements", () => ({
  lockUserDownloadAccess: state.access,
}));
import { LibrarySelectionBatchesRepository } from "../packages/db/src/repositories/library-selection-batches";
import { librarySelectionBatchReceipts } from "../packages/db/src/schema";
const repo = new LibrarySelectionBatchesRepository(),
  date = "2026-10-12T00:00:00.000Z",
  choice = { mode: "fixed" as const, productIds: ["prd_a"] };
const c = ["lcol_a", "Core", "active", 4];
const row = {
  productId: "prd_a",
  title: "Core",
  version: "1",
  targetBuildId: "bld_a",
  revision: 0,
  mode: "latest",
  buildId: null,
  hash: "a".repeat(64),
  size: 10,
};
const command = (previewDigest: string) => ({
  ...choice,
  requestId: "f88ec3b3-b1f8-4af8-87b9-3f9f6f6cba92",
  previewDigest,
});
function previewRows() {
  return [[], [], [["usr_a"]], [c], [["prd_a"]], [{ observedAt: date }], [row]] as unknown[][];
}
function commandRows() {
  return [
    [],
    [],
    [],
    [],
    [["usr_a"]],
    [c],
    [],
    [[0]],
    [["usr_a"]],
    [c],
    [["prd_a"]],
    [["prd_a"]],
    [],
    [{ observedAt: date }],
    [row],
    [["bld_a"]],
    [{ observedAt: date }],
    [row],
  ] as unknown[][];
}
function record(previewDigest: string) {
  const cmd = command(previewDigest);
  return {
    id: "lsbr_a",
    userId: "usr_a",
    collectionId: "lcol_a",
    requestId: cmd.requestId,
    commandDigest: createHash("sha256")
      .update(
        JSON.stringify({
          collectionId: "lcol_a",
          command: {
            mode: cmd.mode,
            productIds: cmd.productIds,
            requestId: cmd.requestId,
            previewDigest: cmd.previewDigest,
          },
        }),
      )
      .digest("hex"),
    command: cmd,
    snapshot: {
      collectionId: "lcol_a",
      collectionRevision: 4,
      mode: "fixed",
      items: [
        {
          productId: "prd_a",
          previous: { revision: 0, mode: "latest", buildId: null },
          next: { revision: 1, mode: "fixed", buildId: "bld_a" },
        },
      ],
    },
    createdAt: date,
  };
}
const recordRow = (r: ReturnType<typeof record>) =>
  Object.keys(getTableColumns(librarySelectionBatchReceipts)).map((k) => r[k as keyof typeof r]);
const input = (digest: string) => ({
  userId: "usr_a",
  collectionId: "lcol_a",
  command: command(digest),
  receiptId: "lsbr_a",
  auditId: "aud_a",
});
const text = () => state.queries.map((q) => q.sql).join("\n");
async function digest() {
  state.rows = previewRows();
  const preview = await repo.preview("usr_a", "lcol_a", choice);
  state.queries = [];
  state.options = [];
  return preview.previewDigest;
}
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
  vi.clearAllMocks();
  state.access.mockResolvedValue({ source: "entitlement", expiresAt: null });
});
it("previews current selected builds in a read-only bounded snapshot without mutation", async () => {
  state.rows = previewRows();
  const result = await repo.preview("usr_a", "lcol_a", choice);
  expect(result).toMatchObject({
    changedCount: 1,
    items: [{ targetBuildId: "bld_a", next: { revision: 1, mode: "fixed", buildId: "bld_a" } }],
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(text()).toContain("pref.mode='fixed' THEN pref.build_id");
  expect(text()).not.toContain("insert into");
  expect(state.access).not.toHaveBeenCalled();
  expect(state.rows).toHaveLength(0);
});
it("applies exact reviewed selections with receipt and mandatory per-resource and batch audits", async () => {
  const d = await digest();
  state.rows = [...commandRows(), [["prd_a"]], [], [recordRow(record(d))], []];
  const result = await repo.command(input(d));
  expect(result).toMatchObject({
    replayed: false,
    receipt: { snapshot: { items: [{ next: { revision: 1, mode: "fixed", buildId: "bld_a" } }] } },
  });
  expect(state.options).toEqual([{ isolationLevel: "read committed" }]);
  expect(state.queries[2].params).toEqual(["library-collections:usr_a"]);
  expect(state.queries[3].params).toEqual(["library-selection:usr_a:prd_a"]);
  expect(text()).toContain('"resource_library_selections"."revision"=excluded.revision-1');
  expect(state.queries.filter((q) => q.sql.includes('insert into "audit_events"'))).toHaveLength(2);
  expect(text()).not.toMatch(/insert into "(?:entitlements|licenses|payments|ledger_entries)"/u);
  expect(state.rows).toHaveLength(0);
});
it("replays an immutable prior operation without reading grants or mutating selections again", async () => {
  const d = await digest();
  state.rows = [[], [], [], [], [["usr_a"]], [c], [recordRow(record(d))]];
  expect(await repo.command(input(d))).toMatchObject({ replayed: true });
  expect(state.access).not.toHaveBeenCalled();
  expect(text()).not.toContain("insert into");
});
it("rejects a reused UUID bound to another collection or command", async () => {
  const d = await digest(),
    prior = record(d);
  prior.commandDigest = "0".repeat(64);
  state.rows = [[], [], [], [], [["usr_a"]], [c], [recordRow(prior)]];
  await expect(repo.command(input(d))).rejects.toMatchObject({
    code: "SELECTION_BATCH_REQUEST_REUSED",
  });
  expect(text()).not.toContain("insert into");
});
it("invalidates a stale review before any write", async () => {
  const d = await digest(),
    rows = commandRows();
  rows[17] = [{ ...row, revision: 1, mode: "fixed", buildId: "bld_a" }];
  state.rows = rows;
  await expect(repo.command(input(d))).rejects.toMatchObject({ code: "SELECTION_BATCH_CHANGED" });
  expect(text()).not.toContain("insert into");
});
it("refuses revoked or expired access after locking", async () => {
  const d = await digest();
  state.rows = commandRows();
  state.access.mockResolvedValue({
    source: "entitlement",
    expiresAt: new Date("2026-10-11T00:00:00Z"),
  });
  await expect(repo.command(input(d))).rejects.toMatchObject({
    code: "SELECTION_BATCH_UNAVAILABLE",
  });
  expect(text()).not.toContain("insert into");
});
it("refuses withdrawn builds before changing any selection", async () => {
  const d = await digest(),
    rows = commandRows();
  rows[15] = [];
  state.rows = rows;
  await expect(repo.command(input(d))).rejects.toMatchObject({ code: "SELECTION_BATCH_CHANGED" });
  expect(text()).not.toContain("insert into");
});
it("rejects foreign collections before inspecting members", async () => {
  state.rows = [[], [], [["usr_a"]], []];
  await expect(repo.preview("usr_a", "lcol_foreign", choice)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(text()).not.toContain('"library_collection_items"');
});
it("rejects non-member IDs before revealing their metadata", async () => {
  const rows = previewRows();
  rows[4] = [];
  state.rows = rows;
  await expect(repo.preview("usr_a", "lcol_a", choice)).rejects.toMatchObject({
    code: "SELECTION_BATCH_CHANGED",
  });
  expect(text()).not.toContain("p.title");
  expect(text()).not.toContain('FROM "products"');
});
it("rejects archived collections and saturated history", async () => {
  const pre = previewRows();
  pre[3] = [["lcol_a", "Core", "archived", 4]];
  state.rows = pre;
  await expect(repo.preview("usr_a", "lcol_a", choice)).rejects.toMatchObject({
    code: "COLLECTION_ARCHIVED",
  });
  state.rows = [[], [], [], [], [["usr_a"]], [c], [], [[5000]]];
  await expect(repo.command(input("a".repeat(64)))).rejects.toMatchObject({
    code: "SELECTION_BATCH_LIMIT",
  });
});
it("rolls out of the command without a receipt if the guarded upsert fails", async () => {
  const d = await digest();
  state.rows = [...commandRows(), []];
  await expect(repo.command(input(d))).rejects.toMatchObject({ code: "SELECTION_BATCH_CHANGED" });
  expect(text()).not.toContain('insert into "library_selection_batch_receipts"');
});
it("rejects direct invalid commands before opening a transaction", async () => {
  await expect(
    repo.command({
      ...input("a".repeat(64)),
      command: { ...command("a".repeat(64)), userId: "other" } as ReturnType<typeof command>,
    }),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
});
