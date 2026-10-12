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

import {
  readLibraryMembershipHistory,
  readLibraryMembershipHistoryDetail,
} from "../packages/db/src/repositories/library-membership-history";
const date = "2026-10-12T00:00:00.000Z",
  requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89";
const command = {
  requestId,
  changes: [
    { collectionId: "lcol_a", expectedRevision: 2, wasInCollection: true, inCollection: false },
    { collectionId: "lcol_b", expectedRevision: 1, wasInCollection: false, inCollection: true },
  ],
};
const digest = (productId = "prd_a", proof = command) =>
  createHash("sha256")
    .update(JSON.stringify({ productId, command: proof }))
    .digest("hex");
const parent = (cmd: unknown = command, hash = digest(), productId = "prd_a", id = "lmb_a") => [
  id,
  requestId,
  productId,
  hash,
  cmd,
  ["lcr_a", "lcr_b"],
  date,
];
const child = (index: number, productId = "prd_a"): unknown[] => {
  const change = command.changes[index];
  if (!change) throw Error("Missing change");
  const uuid = `${index ? "87" : "77"}ca0352-de64-4af9-9e54-7d3c56fe8d89`;
  return [
    index ? "lcr_b" : "lcr_a",
    uuid,
    change.collectionId,
    {
      requestId: uuid,
      action: change.inCollection ? "add" : "remove",
      productId,
      expectedRevision: change.expectedRevision,
    },
    {
      id: change.collectionId,
      name: "Recorded & name",
      status: "active",
      revision: change.expectedRevision + 1,
    },
    date,
  ];
};
const prefix = () => [[["usr_a"]], [{ observedAt: date }]] as unknown[][];
const query = { page: 1, days: 30 as const, operation: "all" as const };
const text = () => state.queries.map((q) => q.sql).join("\n");
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.options = [];
});
it("preserves whole immutable group evidence while separating current own memberships and masked labels", async () => {
  state.rows = [
    ...prefix(),
    [[1]],
    [parent()],
    [child(0), child(1)],
    [
      {
        collectionId: "lcol_a",
        productId: "prd_a",
        id: "lcol_a",
        name: "Later name",
        status: "archived",
        revision: 9,
        inCollection: true,
      },
      {
        collectionId: "lcol_b",
        productId: "prd_a",
        id: "lcol_b",
        name: "Current B",
        status: "active",
        revision: 7,
        inCollection: false,
      },
    ],
    [{ productId: "prd_a", title: "PRIVATE", available: false, storageKey: "PRIVATE" }],
  ];
  const report = await readLibraryMembershipHistory("usr_a", {
    ...query,
    page: 9999,
    operation: "mixed",
    collectionId: "lcol_b",
    productId: "prd_a",
  });
  expect(report.page).toBe(1);
  expect(report.items[0]?.receipt?.children).toHaveLength(2);
  expect(report.items[0]?.receipt?.children[0]?.collection).toMatchObject({
    name: "Recorded & name",
    revision: 3,
    status: "active",
  });
  expect(report.items[0]?.collections[0]).toMatchObject({
    current: { name: "Later name", revision: 9, status: "archived" },
    inCollection: true,
  });
  expect(report.items[0]?.resource).toEqual({
    productId: "prd_a",
    currentTitle: null,
    currentAvailable: false,
  });
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries).toHaveLength(7);
  expect(state.queries[2]?.params).toContain("usr_a");
  expect(state.queries[2]?.params).toContain('[{"collectionId":"lcol_b"}]');
  expect(state.queries[4]?.params).toContain("usr_a");
  expect(state.queries[4]?.params.at(-1)).toBe(400);
  expect(state.queries[5]?.params).toContain("usr_a");
  expect(text()).toContain('refs."productId"');
  expect(text()).toContain("transaction_timestamp()");
  expect(text()).toContain("'product.download'");
  expect(text()).toContain("'published'");
  expect(state.queries[6]?.params).toContain("clean");
  expect(text()).not.toMatch(/insert into|update |delete from|for update/iu);
});
it("binds current membership to both collection and resource across different groups", async () => {
  state.rows = [
    ...prefix(),
    [[2]],
    [parent(), parent(command, digest("prd_b"), "prd_b", "lmb_b")],
    [child(0), child(1)],
    [],
    [],
  ];
  // The second group cannot borrow children belonging to another resource.
  const report = await readLibraryMembershipHistory("usr_a", query);
  expect(report.items[1]?.receipt).toBeNull();
  const references = state.queries[5]?.params.find(
    (value) => typeof value === "string" && value.includes('"collectionId"'),
  );
  expect(references).toBe(
    '[{"collectionId":"lcol_a","productId":"prd_a"},{"collectionId":"lcol_b","productId":"prd_a"}]',
  );
});
it.each(["digest", "hidden", "future", "oversized", "association"])(
  "does not expand invalid parent evidence %s",
  async (kind) => {
    const row = parent();
    if (kind === "digest") row[3] = "0".repeat(64);
    if (kind === "hidden") row[4] = { ...command, storageKey: "PRIVATE" };
    if (kind === "future") row[4] = { requestId, action: "future" };
    if (kind === "oversized") row[5] = Array.from({ length: 21 }, (_, i) => `lcr_${i}`);
    if (kind === "association") row[5] = ["lcr_a", "lcr_a"];
    state.rows = [...prefix(), [[1]], [row]];
    const report = await readLibraryMembershipHistory("usr_a", query);
    expect(report.items[0]).toEqual({
      id: "lmb_a",
      createdAt: date,
      receipt: null,
      resource: null,
      collections: [],
    });
    expect(state.queries).toHaveLength(4);
    expect(JSON.stringify(report)).not.toContain("PRIVATE");
  },
);
it.each(["missing", "identity", "revision", "action", "uuid", "hidden"])(
  "refuses partial or contradictory child evidence %s",
  async (kind) => {
    const a = child(0),
      b = child(1);
    if (kind === "identity") a[2] = "lcol_foreign";
    if (kind === "revision")
      a[4] = { id: "lcol_a", name: "Recorded", status: "active", revision: 99 };
    if (kind === "action") a[3] = { ...(a[3] as object), action: "add" };
    if (kind === "uuid") a[1] = requestId;
    if (kind === "hidden") a[3] = { ...(a[3] as object), ownerId: "PRIVATE" };
    state.rows = [...prefix(), [[1]], [parent()], kind === "missing" ? [a] : [a, b]];
    expect((await readLibraryMembershipHistory("usr_a", query)).items[0]?.receipt).toBeNull();
    expect(state.queries).toHaveLength(5);
  },
);
it("stable own detail survives missing current resource and final reference removal without scope expansion", async () => {
  state.rows = [...prefix(), [parent()], [child(0), child(1)], [], []];
  const detail = await readLibraryMembershipHistoryDetail("usr_a", "lmb_a");
  expect(detail.item.receipt?.id).toBe("lmb_a");
  expect(detail.item.resource?.currentTitle).toBeNull();
  expect(detail.item.collections.every((row) => row.current === null)).toBe(true);
  expect(state.queries[2]?.params).toEqual(["usr_a", "lmb_a", 1]);
  expect(state.queries).toHaveLength(6);
});
it("rejects foreign/unknown details and deleted actors before child or product inspection", async () => {
  state.rows = [...prefix(), []];
  await expect(readLibraryMembershipHistoryDetail("usr_a", "lmb_foreign")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(3);
  state.queries = [];
  state.rows = [[]];
  await expect(readLibraryMembershipHistory("usr_deleted", query)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
});
it("validates bounds before SQL and refuses invalid clocks", async () => {
  for (const change of [
    { page: 10000 },
    { days: 31 },
    { operation: "delete" },
    { collectionId: "../private" },
  ])
    await expect(
      readLibraryMembershipHistory("usr_a", { ...query, ...change } as typeof query),
    ).rejects.toMatchObject({ statusCode: 400 });
  await expect(readLibraryMembershipHistoryDetail("usr_a", "../private")).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
  state.rows = [[["usr_a"]], [{ observedAt: "invalid" }]];
  await expect(readLibraryMembershipHistory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
});
it("handles empty history without child or current-state queries", async () => {
  state.rows = [...prefix(), [[0]], []];
  expect(await readLibraryMembershipHistory("usr_a", query)).toMatchObject({
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  expect(state.queries).toHaveLength(4);
});

it("uses resource-specific current membership when two valid groups share a collection", async () => {
  const otherRequest = "97ca0352-de64-4af9-9e54-7d3c56fe8d89",
    otherCommand = { ...command, requestId: otherRequest };
  const second = [
    "lmb_b",
    otherRequest,
    "prd_b",
    digest("prd_b", otherCommand),
    otherCommand,
    ["lcr_c", "lcr_d"],
    date,
  ];
  const c = child(0, "prd_b"),
    d = child(1, "prd_b");
  c[0] = "lcr_c";
  d[0] = "lcr_d";
  state.rows = [
    ...prefix(),
    [[2]],
    [parent(), second],
    [child(0), child(1), c, d],
    [
      {
        collectionId: "lcol_a",
        productId: "prd_a",
        id: "lcol_a",
        name: "Now",
        status: "active",
        revision: 9,
        inCollection: false,
      },
      {
        collectionId: "lcol_a",
        productId: "prd_b",
        id: "lcol_a",
        name: "Now",
        status: "active",
        revision: 9,
        inCollection: true,
      },
    ],
    [
      { productId: "prd_a", title: "Available", available: true },
      { productId: "prd_b", title: "PRIVATE", available: false },
    ],
  ];
  const report = await readLibraryMembershipHistory("usr_a", query);
  expect(report.items.every((item) => item.receipt !== null)).toBe(true);
  expect(report.items[0]?.collections[0]?.inCollection).toBe(false);
  expect(report.items[1]?.collections[0]?.inCollection).toBe(true);
  expect(report.items[0]?.resource?.currentTitle).toBe("Available");
  expect(report.items[1]?.resource?.currentTitle).toBeNull();
});
