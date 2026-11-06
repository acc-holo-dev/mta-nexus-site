import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { content } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for server-publication-history-query suites. */
export const serverPublicationHistoryQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: [] as unknown[],
  failAudit: false,
  notice: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createServerPublicationHistoryQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = serverPublicationHistoryQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failure");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options?: unknown) => {
            state.transactions.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetServerPublicationHistoryQueryState() {
  const state = serverPublicationHistoryQueryState;
  state.queries = [];
  state.rows = [];
  state.transactions = [];
  state.failAudit = false;
  state.notice.mockReset();
}

export function installServerPublicationHistoryQueryHooks() {
  beforeEach(() => {
    resetServerPublicationHistoryQueryState();
  });
}

export const serverPublicationHistoryQueryTime = "2026-10-11T00:00:00.123456Z";
export const serverPublicationHistoryQueryNext = "2026-10-11T00:00:00.124456Z";

export function serverPublicationHistoryQueryFull(
  extra: Record<string, unknown> = {},
  version = serverPublicationHistoryQueryTime,
) {
  return [
    ...Object.keys(getTableColumns(content)).map(
      (key) =>
        (
          ({
            id: "post",
            serverId: "srv",
            authorId: "original",
            title: "Title",
            body: "Retained full text",
            slug: "article",
            type: "article",
            status: "archived",
            updatedAt: serverPublicationHistoryQueryTime,
            createdAt: serverPublicationHistoryQueryTime,
            ...extra,
          }) as Record<string, unknown>
        )[key] ?? null,
    ),
    version,
  ];
}

export const serverPublicationHistoryQueryAudit = {
  id: "audit",
  actorId: "actor",
  actorType: "user" as const,
  targetId: "post",
  targetType: "content",
  action: "content.restored_by_server",
  details: { serverId: "srv" },
};

export function serverPublicationHistoryQueryWrites() {
  return serverPublicationHistoryQueryState.queries.filter((query) =>
    /^(insert|update|delete)/u.test(query.sql),
  );
}
