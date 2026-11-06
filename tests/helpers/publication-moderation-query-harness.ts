import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { content } from "../../packages/db/src/schema";

/** Shared pg-proxy + notice capture for publication-moderation-query suites. */
export const publicationModerationQueryState = {
  rows: [] as unknown[][][],
  queries: [] as { sql: string; params: unknown[] }[],
  notice: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createPublicationModerationQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = publicationModerationQueryState;
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
          return (work: (tx: typeof database) => unknown) => work(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetPublicationModerationQueryState() {
  vi.clearAllMocks();
  publicationModerationQueryState.rows = [];
  publicationModerationQueryState.queries = [];
}

export function installPublicationModerationQueryHooks() {
  beforeEach(() => {
    resetPublicationModerationQueryState();
  });
}

export const publicationModerationQueryTime = "2026-10-11T00:00:00.000Z";

export function publicationModerationQueryRow(extra: Record<string, unknown> = {}) {
  return Object.keys(getTableColumns(content)).map(
    (key) =>
      (
        ({
          id: "item",
          authorId: "author",
          title: "Draft",
          body: "Reviewed body",
          tags: [],
          slug: "draft",
          type: "article",
          status: "draft",
          createdAt: publicationModerationQueryTime,
          updatedAt: publicationModerationQueryTime,
          ...extra,
        }) as Record<string, unknown>
      )[key] ?? null,
  );
}

export const publicationModerationQueryToken = "staff-session";
export const publicationModerationQueryLiveSession = [["ses_staff", "2099-01-01T00:00:00.000Z"]];
export const publicationModerationQueryAudit = {
  id: "audit",
  actorId: "mod",
  actorType: "admin" as const,
  action: "content.published",
  targetId: "item",
  targetType: "content",
};
