import { beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for license-maintenance-repository suites. */
export const licenseMaintenanceRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  push: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createLicenseMaintenanceRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = licenseMaintenanceRepositoryState;
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
  });
  const database: typeof raw = new Proxy(raw, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof raw) => unknown) => callback(database);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: database };
}

export function resetLicenseMaintenanceRepositoryState() {
  const state = licenseMaintenanceRepositoryState;
  state.queries = [];
  state.results = [];
  state.push.mockReset().mockResolvedValue({ queued: 2, reason: "queued" });
}

export function installLicenseMaintenanceRepositoryHooks() {
  beforeEach(() => {
    resetLicenseMaintenanceRepositoryState();
  });
}

export const licenseMaintenanceRepositoryNow = "2026-10-11T04:00:00.000Z";
export const licenseMaintenanceRepositoryPast = "2026-10-10T04:00:00.000Z";
export const licenseMaintenanceRepositoryFuture = "2026-10-12T04:00:00.000Z";

export function licenseMaintenanceRepositoryClock(expired: boolean) {
  return [
    { now: licenseMaintenanceRepositoryNow, expired },
  ] as unknown as unknown[][];
}
