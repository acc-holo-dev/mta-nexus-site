import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { builds, resourceReleaseEvents } from "../../packages/db/src/schema";

/** Shared pg-proxy + push enqueue capture for resource-release-watches-worker suites. */
export const resourceReleaseWatchesWorkerState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  enqueue: vi.fn(),
  clock: "2026-10-12T00:00:00.000Z",
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceReleaseWatchesWorkerDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = resourceReleaseWatchesWorkerState;
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (sql.includes('AS "observedAt"')) return { rows: [{ observedAt: state.clock }] };
    return { rows: state.rows.shift() ?? [] };
  });
  const db: typeof raw = new Proxy(raw, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof raw) => unknown) => callback(db);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db };
}

function resetResourceReleaseWatchesWorkerState() {
  vi.clearAllMocks();
  resourceReleaseWatchesWorkerState.queries = [];
  resourceReleaseWatchesWorkerState.rows = [];
  resourceReleaseWatchesWorkerState.clock = "2026-10-12T00:00:00.000Z";
  resourceReleaseWatchesWorkerState.enqueue.mockResolvedValue({ queued: 2, reason: "queued" });
}

export function installResourceReleaseWatchesWorkerHooks() {
  beforeEach(() => {
    resetResourceReleaseWatchesWorkerState();
  });
}

export function resourceReleaseWatchesWorkerEvent() {
  const values: Record<string, unknown> = {
    sequence: "9007199254740993",
    productId: "prd_a",
    buildId: "bld_a",
    version: "2.0.0",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
    createdAt: "2026-10-11T00:00:00Z",
  };
  return Object.keys(getTableColumns(resourceReleaseEvents)).map((key) => values[key]);
}

export function resourceReleaseWatchesWorkerRows(enabled = true, safe = true) {
  return [
    [],
    [],
    [["usr_a", "prd_a"]],
    [["prd_a", "Public resource", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [[1, "9007199254740992"]],
    [resourceReleaseWatchesWorkerEvent()],
    safe ? [["bld_a"]] : [],
    [],
    [[enabled]],
    ...(enabled && safe ? [[]] : []),
    [["prd_a"]],
    [],
  ];
}

export function resourceReleaseWatchesWorkerBuildRow(artifact: Record<string, unknown>) {
  return Object.keys(getTableColumns(builds)).map((key) => artifact[key] ?? null);
}
