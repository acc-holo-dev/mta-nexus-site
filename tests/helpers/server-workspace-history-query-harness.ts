import { createHash } from "node:crypto";
import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for server-workspace-history-query suites. */
export const serverWorkspaceHistoryQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: null as unknown,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createServerWorkspaceHistoryQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = serverWorkspaceHistoryQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options: unknown) => {
            state.options = options;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export const serverWorkspaceHistoryQueryUntil = "2026-10-12T00:00:00.123456Z";
export const serverWorkspaceHistoryQueryFilters = {
  action: "all" as const,
  period: "all" as const,
};

export function serverWorkspaceHistoryQueryEvent(id = "audit") {
  return [
    id,
    "server.updated",
    "editor",
    "user",
    "editor",
    "Editor",
    ["visibility"],
    "2026-10-11T00:00:00.000Z",
    "public",
    "private",
  ];
}

export function serverWorkspaceHistoryQueryContext(
  actor = "actor",
  period = "all",
  action = "all",
) {
  return createHash("sha256")
    .update(JSON.stringify([1, "server-management-history", actor, "server", period, action]))
    .digest("hex");
}

function resetServerWorkspaceHistoryQueryState() {
  serverWorkspaceHistoryQueryState.queries = [];
  serverWorkspaceHistoryQueryState.options = null;
  serverWorkspaceHistoryQueryState.rows = [
    [["server", "Server", "server"]],
    [[serverWorkspaceHistoryQueryUntil]],
    [serverWorkspaceHistoryQueryEvent()],
  ];
}

export function installServerWorkspaceHistoryQueryHooks() {
  beforeEach(() => {
    resetServerWorkspaceHistoryQueryState();
  });
}
