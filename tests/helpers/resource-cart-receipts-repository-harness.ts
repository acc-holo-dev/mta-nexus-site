import { beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for resource-cart-receipts-repository suites. */
export const resourceCartReceiptsRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: [] as unknown[],
  claim: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceCartReceiptsRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = resourceCartReceiptsRepositoryState;
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
}

function resetResourceCartReceiptsRepositoryState() {
  const state = resourceCartReceiptsRepositoryState;
  vi.clearAllMocks();
  state.rows = [];
  state.queries = [];
  state.options = [];
  state.claim.mockResolvedValue([
    {
      accessSource: "entitlement",
      alreadyClaimed: false,
      entitlement: { expiresAt: null },
    },
  ]);
}

export function installResourceCartReceiptsRepositoryHooks() {
  beforeEach(() => {
    resetResourceCartReceiptsRepositoryState();
  });
}

export const resourceCartReceiptsRepositoryRequestId =
  "11111111-1111-4111-8111-111111111111";

export const resourceCartReceiptsRepositoryRow = {
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

export const resourceCartReceiptsRepositoryInput = {
  userId: "usr_a",
  currentToken: "cart-token",
  productIds: ["prd_a"],
  requestId: resourceCartReceiptsRepositoryRequestId,
  entitlementIds: ["ent_a"],
  auditId: "aud_a",
};

export function resourceCartReceiptsRepositoryAcquireRows(
  review = resourceCartReceiptsRepositoryRow,
  recheck = resourceCartReceiptsRepositoryRow,
) {
  return [[], [], [["prd_a"]], [], [["prd_a"]], [review], [["bld_a"]], [recheck], [], [], []];
}
