import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
  claim: vi.fn(),
}));
vi.mock("../packages/db/src/repositories/entitlements", () => ({
  claimFreeResourceInTransaction: state.claim,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  const db: typeof raw = new Proxy(raw, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof raw) => unknown, options?: unknown) => {
          state.options.push(options);
          return callback(db);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db };
});
import { resourceCartRepository as cart } from "../packages/db/src/repositories/resource-cart";
import { resourceCartReceiptsRepository as receipts } from "../packages/db/src/repositories/resource-cart-receipts";
const requestId = "11111111-1111-4111-8111-111111111111";
const row = {
  productId: "prd_a",
  available: true,
  alreadyOwned: false,
  title: "Original title",
  slug: "resource",
  metadataRevision: "2026-10-11T00:00:00.000001Z",
  buildId: "bld_a",
  version: "1.0.0",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 7,
  mtaMinVersion: "1.6.0",
  dependencies: ["base_resource"],
};
const input = {
  userId: "usr_a",
  productIds: ["prd_a"],
  requestId,
  entitlementIds: ["ent_a"],
  auditId: "aud_a",
};
beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [];
  state.queries = [];
  state.options = [];
  state.claim.mockResolvedValue({
    accessSource: "entitlement",
    alreadyClaimed: false,
    entitlement: { expiresAt: null },
  });
});
async function preview() {
  state.rows = [[row]];
  const result = await cart.review("usr_a");
  state.queries = [];
  if (!result.reviewDigest) throw new Error("Missing review");
  return result.reviewDigest;
}
function acquireRows(review = row, recheck = row) {
  return [
    [],
    [],
    [["prd_a"]],
    [],
    [["prd_a"]],
    [["usr_a"]],
    [review],
    [["bld_a"]],
    [recheck],
    [],
    [],
    [],
  ];
}
it("reviews only the actor's narrow current public evidence in a stable snapshot", async () => {
  state.rows = [[row]];
  const result = await cart.review("usr_a");
  expect(result.items[0]).not.toHaveProperty("metadataRevision");
  expect(result.reviewDigest).toMatch(/^[a-f0-9]{64}$/u);
  expect(state.queries[0].params).toContain("usr_a");
  expect(state.queries[0].sql).toContain("artifact.file_size_bytes between 1 and 67108864");
  expect(state.queries[0].sql).not.toContain("storage_key");
  expect(state.options[0]).toMatchObject({
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
});
it("records exact reviewed evidence, result and receipt key atomically without financial operations", async () => {
  const reviewDigest = await preview();
  state.rows = acquireRows();
  expect(await cart.acquire({ ...input, reviewDigest })).toMatchObject({
    requestId,
    acquired: [{ productId: "prd_a", alreadyClaimed: false }],
  });
  expect(state.queries[4].sql).toContain("for no key update");
  expect(state.queries[5].sql).toContain("for share");
  expect(state.queries[7].sql).toContain("for share");
  expect(state.claim).toHaveBeenCalledOnce();
  const persisted = state.queries.at(-1);
  if (!persisted) throw new Error("Missing receipt insert");
  expect(persisted.sql).toContain('insert into "resource_cart_acquisitions"');
  expect(persisted.params).toContain(reviewDigest);
  const snapshot = persisted.params.find(
    (value) => typeof value === "string" && value.includes('"accessSource"'),
  );
  expect(JSON.parse(String(snapshot))).toEqual([
    expect.objectContaining({
      title: "Original title",
      buildId: "bld_a",
      version: "1.0.0",
      sha256Hash: "a".repeat(64),
      accessSource: "entitlement",
      recordedExpiresAt: null,
    }),
  ]);
  expect(
    state.queries.some(
      (query) =>
        /"(orders|payments|ledger_entries|licenses)"/.test(query.sql.split(" where ")[0]) &&
        query.sql.startsWith("insert"),
    ),
  ).toBe(false);
});
it.each(["metadataRevision", "buildId", "sha256Hash"])(
  "a changed %s stops acquisition before any grant",
  async (field) => {
    const reviewDigest = await preview();
    state.rows = acquireRows({ ...row, [field]: "changed" });
    await expect(cart.acquire({ ...input, reviewDigest })).rejects.toMatchObject({
      code: "RESOURCE_CART_REVIEW_CHANGED",
    });
    expect(state.claim).not.toHaveBeenCalled();
    expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
  },
);
it("rechecks after the selected build lock and preserves finite legacy access facts", async () => {
  const reviewDigest = await preview();
  state.rows = acquireRows(row, { ...row, available: false });
  await expect(cart.acquire({ ...input, reviewDigest })).rejects.toMatchObject({
    code: "RESOURCE_CART_REVIEW_CHANGED",
  });
  expect(state.claim).not.toHaveBeenCalled();
  state.rows = acquireRows();
  state.queries = [];
  state.claim.mockResolvedValueOnce({
    accessSource: "license",
    alreadyClaimed: true,
    entitlement: null,
    license: { expiresAt: new Date("2026-11-01T00:00:00Z") },
  });
  await cart.acquire({ ...input, reviewDigest });
  expect(String(state.queries.at(-1)?.params)).toContain("2026-11-01T00:00:00.000Z");
});
it("exact receipt replay survives a cleared cart and refuses a different review", async () => {
  const result = {
    kind: "free_resource_acquisition",
    acquired: [{ productId: "prd_a", alreadyClaimed: false }],
    requestId,
  };
  state.rows = [[], [[["prd_a"], result, "a".repeat(64)]]];
  expect(await cart.acquire({ ...input, reviewDigest: "a".repeat(64) })).toEqual(result);
  expect(state.queries).toHaveLength(2);
  state.rows = [[], [[["prd_a"], result, "a".repeat(64)]]];
  await expect(cart.acquire({ ...input, reviewDigest: "b".repeat(64) })).rejects.toMatchObject({
    code: "RESOURCE_CART_REQUEST_CONFLICT",
  });
  expect(state.claim).not.toHaveBeenCalled();
});
it("keeps frozen receipt metadata while separately checking current exact-version access", async () => {
  const {
    metadataRevision: _revision,
    available: _available,
    alreadyOwned: _owned,
    ...evidence
  } = row;
  const snapshot = [
    { ...evidence, alreadyClaimed: false, accessSource: "entitlement", recordedExpiresAt: null },
  ];
  state.rows = [
    [[requestId, "2026-10-11T00:00:00Z", ["prd_a"], snapshot, "a".repeat(64)]],
    [{ productId: "prd_a", buildId: "bld_a", hasCurrentAccess: false, downloadable: false }],
  ];
  const result = await receipts.detail("usr_a", requestId);
  expect(result.items[0]).toMatchObject({ title: "Original title", downloadable: false });
  expect(state.queries[0].params).toEqual(["usr_a", requestId, 1]);
  expect(state.queries[1].sql).toContain('snapshot."sha256Hash"');
  expect(state.queries[1].sql).not.toContain('"products"."title"');
});
it("legacy receipts do not invent historical versions or query current catalog metadata", async () => {
  state.rows = [[[requestId, "2026-10-11T00:00:00Z", ["prd_a"], null, null]]];
  expect(await receipts.detail("usr_a", requestId)).toMatchObject({
    reviewed: false,
    items: [],
    legacyProductCount: 1,
  });
  expect(state.queries).toHaveLength(1);
});
it("bounds filtered receipt history in one account and returns no result payload", async () => {
  state.rows = [[[41]], []];
  await receipts.page("usr_a", { page: 99, days: 7, evidence: "reviewed" });
  expect(state.queries[1].params.at(-2)).toBe(20);
  expect(state.queries[1].params.at(-1)).toBe(40);
  expect(state.queries[1].sql).not.toContain('"result"');
  expect(state.queries[0].params).toContain("usr_a");
});
