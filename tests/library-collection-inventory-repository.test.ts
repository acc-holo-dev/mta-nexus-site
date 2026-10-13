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

import { readLibraryCollectionInventory } from "../packages/db/src/repositories/library-collection-inventory";
const date = "2026-10-13T00:00:00.000Z",
  query = { page: 1, status: "all" as const, filter: "all" as const, q: "" };
const own = () => [
  ["lcol_a", "Active & name", "active", 4, 2],
  ["lcol_b", "Archived", "archived", 7, 1],
];
const summary = {
  resources: 2,
  references: 3,
  available: 1,
  unavailable: 1,
  shared: 1,
  total: 2,
  releaseLatest: 1,
  releasePinned: 0,
  releaseUpdates: 0,
  selectionUnavailable: 0,
  attention: 1,
};
const prefix = () => [[["usr_a"]], own(), [{ observedAt: date }]] as unknown[][];
const rows = () => [
  {
    productId: "prd_a",
    title: "Accessible",
    available: true,
    membershipCount: 2,
    mode: "latest",
    revision: 0,
    canReviewRequirements: true,
    state: "latest",
    latestBuildId: "bld_latest",
    latestVersion: "2.0.0",
    selectedBuildId: null,
    selectedVersion: null,
    storageKey: "PRIVATE",
  },
  { productId: "prd_orphan", title: "PRIVATE", available: false, membershipCount: 1 },
];
const memberships = () => [
  ["prd_a", "lcol_a", date],
  ["prd_a", "lcol_b", date],
  ["prd_orphan", "lcol_a", date],
];
const text = () => state.queries.map((q) => q.sql).join("\n");
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.options = [];
});
it("deduplicates own references while retaining every current membership and masking unavailable names", async () => {
  state.rows = [...prefix(), [summary], rows(), memberships()];
  const report = await readLibraryCollectionInventory("usr_a", query);
  expect(report.counts).toEqual({
    resources: 2,
    references: 3,
    available: 1,
    unavailable: 1,
    shared: 1,
  });
  expect(report.items[0]).toMatchObject({
    productId: "prd_a",
    title: "Accessible",
    available: true,
    memberships: [
      { id: "lcol_a", status: "active", revision: 4 },
      { id: "lcol_b", status: "archived", revision: 7 },
    ],
  });
  expect(report.items[1]).toMatchObject({ productId: "prd_orphan", title: null, available: false });
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries).toHaveLength(6);
  expect(state.queries[1]?.params).toContain("usr_a");
  expect(state.queries[3]?.params).toContain("usr_a");
  expect(state.queries[5]?.params).toContain("usr_a");
  expect(state.queries[5]?.params.at(-1)).toBe(601);
  expect(text()).toContain("transaction_timestamp()");
  expect(text()).toContain("'product.download'");
  expect(text()).toContain("'published'");
  expect(state.queries[3]?.params).toContain("clean");
  expect(text()).not.toMatch(/insert into|update |delete from|for update/iu);
});
it("qualifies resources by a matching collection/status without cutting archived memberships from the result", async () => {
  state.rows = [...prefix(), [{ ...summary, total: 1 }], [rows()[0]], memberships().slice(0, 2)];
  const report = await readLibraryCollectionInventory("usr_a", {
    ...query,
    status: "active",
    collectionId: "lcol_a",
    filter: "shared",
    q: "Accessible",
  });
  expect(report.items[0]?.memberships).toHaveLength(2);
  expect(state.queries[3]?.params).toContain("lcol_a");
  expect(state.queries[3]?.params).toContain("active");
  expect(text()).toContain("bool_or(");
  expect(text()).toContain('"membershipCount">1');
});
it("treats percent, underscore and slash literally and searches only masked titles or recorded IDs", async () => {
  state.rows = [...prefix(), [{ ...summary, total: 0 }], []];
  await readLibraryCollectionInventory("usr_a", { ...query, q: "%_\\" });
  expect(state.queries[3]?.params).toContain("%\\%\\_\\\\%");
  expect(text()).toContain("title ILIKE");
  expect(text()).toContain('"productId" ILIKE');
  expect(text()).toContain("CASE WHEN owned.resource_id IS NOT NULL");
});
it("clamps requested pages to the bounded last page and does not expose pagination offset", async () => {
  state.rows = [
    ...prefix(),
    [
      {
        resources: 41,
        references: 41,
        available: 0,
        unavailable: 41,
        shared: 0,
        total: 41,
        releaseLatest: 0,
        releasePinned: 0,
        releaseUpdates: 0,
        selectionUnavailable: 0,
        attention: 41,
      },
    ],
    [rows()[1]],
    [memberships()[2]],
  ];
  const report = await readLibraryCollectionInventory("usr_a", { ...query, page: 9999 });
  expect(report.page).toBe(3);
  expect(report.pageSize).toBe(20);
  expect(report).not.toHaveProperty("offset");
  expect(state.queries[4]?.params.slice(-2)).toEqual([20, 40]);
});
it("requires current own collection identity before any resource metadata lookups", async () => {
  state.rows = [[["usr_a"]], own()];
  await expect(
    readLibraryCollectionInventory("usr_a", { ...query, collectionId: "lcol_foreign" }),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(2);
  state.queries = [];
  state.rows = [[]];
  await expect(readLibraryCollectionInventory("usr_deleted", query)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
});
it("validates direct selectors before SQL and rejects invalid database clocks", async () => {
  for (const invalid of [
    { page: 0 },
    { page: 10000 },
    { status: "deleted" },
    { filter: "private" },
    { q: "a\u0000" },
    { userId: "other" },
    { collectionId: "../private" },
  ])
    await expect(
      readLibraryCollectionInventory("usr_a", { ...query, ...invalid } as typeof query),
    ).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
  state.rows = [[["usr_a"]], own(), [{ observedAt: "invalid" }]];
  await expect(readLibraryCollectionInventory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
});
it.each([
  "over-quota",
  "foreign-membership",
  "missing-membership",
  "duplicate-membership",
  "invalid-clock",
])("fails closed on inconsistent bounded reference projections: %s", async (kind) => {
  const memberRows = memberships();
  if (kind === "foreign-membership") memberRows[0] = ["prd_a", "lcol_foreign", date];
  if (kind === "missing-membership") memberRows.pop();
  if (kind === "duplicate-membership") memberRows[1] = memberRows[0] ?? [];
  if (kind === "invalid-clock") memberRows[0] = ["prd_a", "lcol_a", "invalid"];
  state.rows = [
    ...prefix(),
    [kind === "over-quota" ? { ...summary, references: 6001 } : summary],
    rows(),
    memberRows,
  ];
  await expect(readLibraryCollectionInventory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
});
it("bounds own collection/item counts before scanning resource authority", async () => {
  state.rows = [
    [["usr_a"]],
    Array.from({ length: 31 }, (_, i) => [`lcol_${i}`, "Name", "active", 1, 1]),
  ];
  await expect(readLibraryCollectionInventory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
  state.rows = [[["usr_a"]], [["lcol_a", "Name", "active", 1, 201]]];
  await expect(readLibraryCollectionInventory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
});
it("handles empty or contradictory structural scopes without product or grant queries", async () => {
  state.rows = [[["usr_a"]], [], [{ observedAt: date }]];
  const report = await readLibraryCollectionInventory("usr_a", query);
  expect(report).toMatchObject({
    items: [],
    counts: { resources: 0, references: 0 },
    page: 1,
    totalPages: 1,
  });
  expect(report).not.toHaveProperty("offset");
  expect(state.queries).toHaveLength(3);
  state.queries = [];
  state.rows = prefix();
  const empty = await readLibraryCollectionInventory("usr_a", {
    ...query,
    collectionId: "lcol_b",
    status: "active",
  });
  expect(empty.items).toEqual([]);
  expect(state.queries).toHaveLength(3);
  expect(text()).not.toContain("entitlements");
});

it("reports one own version choice across active and archived memberships and withholds inaccessible preference metadata", async () => {
  const items = [
    {
      ...rows()[0],
      mode: "fixed",
      revision: 3,
      state: "update_available",
      selectedBuildId: "bld_old",
      selectedVersion: "1.0.0",
    },
    {
      ...rows()[1],
      mode: "fixed",
      revision: 7,
      state: "update_available",
      latestBuildId: "PRIVATE",
      latestVersion: "PRIVATE",
      selectedBuildId: "PRIVATE",
      selectedVersion: "PRIVATE",
    },
  ];
  state.rows = [
    ...prefix(),
    [{ ...summary, releaseLatest: 0, releasePinned: 1, releaseUpdates: 1, attention: 2 }],
    items,
    memberships(),
  ];
  const report = await readLibraryCollectionInventory("usr_a", { ...query, release: "attention" });
  expect(report.releaseCounts).toEqual({
    latest: 0,
    pinned: 1,
    updates: 1,
    selectionUnavailable: 0,
    attention: 2,
  });
  expect(report.items[0]?.release).toEqual({
    state: "update_available",
    mode: "fixed",
    revision: 3,
    canReviewRequirements: true,
    latest: { buildId: "bld_latest", version: "2.0.0" },
    effective: { buildId: "bld_old", version: "1.0.0" },
  });
  expect(report.items[0]?.memberships).toHaveLength(2);
  expect(report.items[1]?.release).toBeNull();
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(text()).toContain("pref.user_id=");
  expect(text()).toMatch(/ORDER BY "builds"\."created_at" DESC,"builds"\."id" DESC/u);
  expect(text()).not.toMatch(/storage_key|sha256_hash|file_size_bytes|select \*/iu);
});
it("does not replace a withdrawn fixed build with the safe latest build", async () => {
  state.rows = [
    ...prefix(),
    [
      {
        ...summary,
        total: 1,
        releaseLatest: 0,
        releasePinned: 1,
        selectionUnavailable: 1,
        attention: 2,
      },
    ],
    [{ ...rows()[0], mode: "fixed", revision: 4, state: "selection_unavailable" }],
    memberships().slice(0, 2),
  ];
  const report = await readLibraryCollectionInventory("usr_a", {
    ...query,
    filter: "available",
    release: "selection-unavailable",
  });
  expect(report.items[0]?.available).toBe(true);
  expect(report.items[0]?.release).toMatchObject({
    state: "selection_unavailable",
    effective: null,
    latest: { buildId: "bld_latest" },
  });
  expect(text()).toContain("available AND state='selection_unavailable'");
  expect(text()).toContain('"builds"."id"=pref.build_id');
});
it.each([
  { mode: "fixed", revision: 0 },
  { mode: "admin" },
  { revision: 2147483648 },
  { latestBuildId: "../private" },
  { latestVersion: "version\u0000" },
  { state: "update_available" },
  {
    mode: "fixed",
    revision: 2,
    state: "pinned",
    selectedBuildId: "bld_latest",
    selectedVersion: "different",
  },
])("rejects corrupt accessible release proof before returning any plan: %j", async (invalid) => {
  state.rows = [...prefix(), [summary], [{ ...rows()[0], ...invalid }], memberships().slice(0, 2)];
  await expect(readLibraryCollectionInventory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
});
it("rejects contradictory aggregate version counts", async () => {
  state.rows = [...prefix(), [{ ...summary, releaseUpdates: 1 }]];
  await expect(readLibraryCollectionInventory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
  expect(state.queries).toHaveLength(4);
});
