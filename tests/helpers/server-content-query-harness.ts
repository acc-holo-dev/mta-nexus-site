import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { content } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for server-content-query suites. */
export const serverContentQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  snapshots: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createServerContentQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = serverContentQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (work: (tx: typeof database) => unknown, options?: unknown) => {
            state.snapshots.push(options);
            return work(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetServerContentQueryState() {
  serverContentQueryState.queries = [];
  serverContentQueryState.rows = [];
  serverContentQueryState.snapshots = [];
}

export function installServerContentQueryHooks() {
  beforeEach(() => {
    resetServerContentQueryState();
  });
}

export const serverContentQueryTime = "2026-10-11T00:00:00.000Z";

export function serverContentQueryRow(extra: Record<string, unknown> = {}) {
  const time = serverContentQueryTime;
  return Object.keys(getTableColumns(content)).map(
    (key) =>
      (
        ({
          id: "item",
          authorId: "writer",
          serverId: "srv",
          organizationId: null,
          slug: "original",
          title: "Original",
          body: "Original publication",
          type: "article",
          status: "published",
          tags: [],
          createdAt: time,
          updatedAt: time,
          commentCount: 4,
          ...extra,
        }) as Record<string, unknown>
      )[key] ?? null,
  );
}

export const serverContentQueryFields = {
  title: "Edited",
  body: "A useful publication body",
  tags: ["Lua"],
  excerpt: "",
  coverImageUrl: "",
};

export const serverContentQueryAudit = {
  id: "audit",
  actorId: "actor",
  actorType: "user" as const,
  targetId: "item",
  targetType: "content",
  action: "content.edited_by_server",
};

/** Shared publication-notice mock factory for suite files under `tests/`. */
export function createServerContentQueryPublicationNoticeMock() {
  return {
    publicationNotice: vi.fn(),
  };
}
