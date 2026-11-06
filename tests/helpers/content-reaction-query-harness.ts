import { beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for content-reaction-query suites. */
export const contentReactionQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
  notice: vi.fn(),
  session: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createContentReactionQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = contentReactionQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failure");
    return {
      rows:
        sql.startsWith("select") && !sql.includes("pg_advisory_xact_lock")
          ? (state.rows.shift() ?? [])
          : [],
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

export function resetContentReactionQueryState() {
  vi.clearAllMocks();
  contentReactionQueryState.queries = [];
  contentReactionQueryState.rows = [];
  contentReactionQueryState.failAudit = false;
}

export function installContentReactionQueryHooks() {
  beforeEach(() => {
    resetContentReactionQueryState();
  });
}

export const contentReactionQueryCommand = {
  actorId: "actor",
  currentToken: "actor-token",
  slug: "guide",
  reaction: "helpful" as "helpful" | "thanks" | null,
  reactionId: "new",
  auditId: "audit",
};

export function contentReactionQueryWrites() {
  return contentReactionQueryState.queries.filter((query) =>
    /^(insert|delete|update)/u.test(query.sql),
  );
}

export function contentReactionQueryFixture(
  existing: unknown[][] = [],
  status = "published",
  author = "author",
) {
  contentReactionQueryState.rows = [
    [["content", "guide", status, "article", author]],
    [["actor"]],
    existing,
    [["👍", 1]],
  ];
}
