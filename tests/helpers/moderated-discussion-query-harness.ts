import { createHash } from "node:crypto";
import { beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for moderated-discussion-query suites. */
export const moderatedDiscussionQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
  notice: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createModeratedDiscussionQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = moderatedDiscussionQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: sql.startsWith("select") ? (state.rows.shift() ?? []) : [] };
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

function resetModeratedDiscussionQueryState() {
  const state = moderatedDiscussionQueryState;
  state.queries = [];
  state.rows = [];
  state.config = null;
  state.notice.mockReset();
}

export function installModeratedDiscussionQueryHooks() {
  beforeEach(() => {
    resetModeratedDiscussionQueryState();
  });
}

export const moderatedDiscussionQueryTime = "2026-10-11T00:00:00.123456Z";
export const moderatedDiscussionQueryPublication = [
  "post",
  "Private publication",
  "guide",
  "post",
  "archived",
];

export const moderatedDiscussionQueryDigest = createHash("sha256")
  .update("Complete text 🧑‍💻")
  .digest("hex");

export function moderatedDiscussionQueryWrites() {
  return moderatedDiscussionQueryState.queries.filter((query) =>
    /^(insert|update|delete)/u.test(query.sql),
  );
}

export function moderatedDiscussionQueryMutationRows(
  role = "moderator",
  status = "archived",
  type = "post",
) {
  moderatedDiscussionQueryState.rows = [
    [["post", status, "guide", type]],
    [["comment", "Bounded text", "author", moderatedDiscussionQueryDigest]],
    [[role]],
  ];
}
