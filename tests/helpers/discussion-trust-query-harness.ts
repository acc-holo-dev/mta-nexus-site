import { createHash } from "node:crypto";
import { beforeEach, vi } from "vitest";

/** Mirrors packages/db discussionRevision without importing the repository (avoids client mock cycles). */
export function discussionTrustQueryRevision(id: string, text: string) {
  return createHash("sha256").update(JSON.stringify([id, text])).digest("hex");
}

/** Shared pg-proxy query capture for discussion-trust-query suites. */
export const discussionTrustQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: [] as unknown[],
  notice: vi.fn(),
  failAudit: false,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createDiscussionTrustQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = discussionTrustQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("Audit unavailable");
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (work: (tx: typeof database) => unknown, options: unknown) => {
            state.transactions.push(options);
            return work(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetDiscussionTrustQueryState() {
  const state = discussionTrustQueryState;
  state.queries = [];
  state.rows = [];
  state.transactions = [];
  state.failAudit = false;
  state.notice.mockReset();
}

export function installDiscussionTrustQueryHooks() {
  beforeEach(() => {
    resetDiscussionTrustQueryState();
  });
}

export const discussionTrustQueryTime = "2026-10-11T00:00:00.123456Z";

export function discussionTrustQueryContext(subject = "subject", type = "") {
  return createHash("sha256")
    .update(JSON.stringify([1, "public-approvals", subject, type]))
    .digest("hex");
}

export function discussionTrustQueryCommand(extra = {}) {
  return {
    contentId: "content",
    ownWorkspace: true,
    commentId: "comment",
    actorId: "author",
    expectedRevision: discussionTrustQueryRevision("comment", "Original"),
    auditId: "audit",
    ...extra,
  };
}

export function discussionTrustQueryMutationRows(
  status = "published",
  author = "author",
  role = "user",
  type = "post",
) {
  discussionTrustQueryState.rows = [
    [["content", status, "guide", type]],
    [["comment", "Original", author]],
    [[role]],
  ];
}
