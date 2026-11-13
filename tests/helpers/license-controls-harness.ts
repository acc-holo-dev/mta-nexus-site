import { getTableColumns } from "drizzle-orm";
import { licenseRuntimeBindings } from "../../site/packages/db/src/schema";

/** Shared pg-proxy query capture for license-controls repository suites. */
export const licenseControlsState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../../site/packages/db/src/client", …)` from suite files under `tests/unit` or `tests/database`. */
export async function createLicenseControlsDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    licenseControlsState.queries.push({ sql, params });
    return { rows: licenseControlsState.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, options?: unknown) => {
            licenseControlsState.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export const revision = "2026-10-10T00:00:00.000Z";
export const now = "2026-10-10T01:00:00.000Z";
export const future = "2026-10-20T00:00:00.000Z";
export const updated = "2026-10-10T01:00:00.001Z";

export const owner = {
  licenseId: "lic_a",
  actorId: "usr_a",
  auditId: "aud_a",
  currentToken: "session-owner",
};

export const actorRow = [["usr_a"]];
export const sessionRow = [["ses_a", "2099-01-01T00:00:00.000Z"]];
export const clockRow = [{ now }] as unknown as unknown[][];

export const releaseCommand = {
  serverId: "srv_a",
  productId: "prd_a",
  buildId: "bld_a",
  sha256Hash: "b".repeat(64),
  nonce: "cc98ca86-5a01-4b7f-b2ac-1eabbeff533f",
};

export function bindingRow(overrides: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    licenseId: "lic_a",
    serverId: "srv_a",
    organizationId: null,
    endpointRevision: 2,
    serverOwnerId: "usr_a",
    tokenDigest: "a".repeat(64),
    tokenIssuedAt: revision,
    tokenExpiresAt: future,
    createdAt: revision,
    updatedAt: revision,
    ...overrides,
  };
  return Object.keys(getTableColumns(licenseRuntimeBindings)).map((key) => row[key]);
}

export function rotationResults(expiry = future, serverRevision = 2) {
  return [
    [["prd_a", "srv_a", "srv_a"]],
    [["prd_a"]],
    [["srv_a", null]],
    [["srv_a"]],
    [["lic_a", "prd_a", "srv_a", "single_server", "active", expiry, revision]],
    [bindingRow()],
    actorRow,
    sessionRow,
    clockRow,
    [["srv_a", null, serverRevision, "usr_a"]],
    [["lic_a"]],
    [],
    [["lic_a", "active", updated]],
    [],
  ];
}

export function resetLicenseControlsState() {
  licenseControlsState.queries = [];
  licenseControlsState.results = [];
  licenseControlsState.options = [];
}
