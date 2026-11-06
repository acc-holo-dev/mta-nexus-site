import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { supportCases } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for support-message-discovery-query suites. */
export const supportMessageDiscoveryQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: undefined as unknown,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createSupportMessageDiscoveryQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = supportMessageDiscoveryQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetSupportMessageDiscoveryQueryState() {
  supportMessageDiscoveryQueryState.queries = [];
  supportMessageDiscoveryQueryState.rows = [];
  supportMessageDiscoveryQueryState.config = undefined;
}

export function installSupportMessageDiscoveryQueryHooks() {
  beforeEach(() => {
    resetSupportMessageDiscoveryQueryState();
  });
}

export const supportMessageDiscoveryQueryId = `sup_${"a".repeat(24)}`;
export const supportMessageDiscoveryQueryMessageId = `spm_${"b".repeat(24)}`;
export const supportMessageDiscoveryQueryStamp = "2026-10-12T00:00:00.123456Z";
export const supportMessageDiscoveryQueryBase = { group: "all" as const, query: "" };

export function supportMessageDiscoveryQueryRow(extra: Record<string, unknown> = {}) {
  const id = supportMessageDiscoveryQueryId;
  const stamp = supportMessageDiscoveryQueryStamp;
  return Object.keys(getTableColumns(supportCases)).map(
    (key) =>
      ({
        id,
        requesterId: "owner",
        subject: "Private case",
        category: "account",
        status: "open",
        relatedType: "purchase",
        relatedId: "private-order",
        createdAt: stamp,
        updatedAt: stamp,
        ...extra,
      })[key as "id"],
  );
}

export function supportMessageDiscoveryQueryFingerprint(
  actor = "owner",
  group = "all",
  query = "",
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        1,
        "support-messages",
        actor,
        supportMessageDiscoveryQueryId,
        "all",
        group,
        query,
      ]),
    )
    .digest("hex");
}

export const supportMessageDiscoveryQueryCursor = {
  version: 1 as const,
  context: supportMessageDiscoveryQueryFingerprint(),
  until: supportMessageDiscoveryQueryStamp,
  id: supportMessageDiscoveryQueryMessageId,
  direction: "older" as const,
};
