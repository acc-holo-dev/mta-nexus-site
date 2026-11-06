import { beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for publication-management-query suites. */
export const publicationManagementQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
  notice: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createPublicationManagementQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    publicationManagementQueryState.queries.push({ sql, params });
    if (
      publicationManagementQueryState.failAudit &&
      sql.startsWith('insert into "audit_events"')
    )
      throw new Error("audit failure");
    return { rows: publicationManagementQueryState.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

/** Factory for discussion-moderation-notice mock from suite files under `tests/`. */
export function createPublicationManagementQueryNoticeMock() {
  return { discussionModerationNotice: publicationManagementQueryState.notice };
}

export function resetPublicationManagementQueryState() {
  publicationManagementQueryState.queries = [];
  publicationManagementQueryState.rows = [];
  publicationManagementQueryState.failAudit = false;
  publicationManagementQueryState.notice.mockReset();
}

export function installPublicationManagementQueryHooks() {
  beforeEach(() => {
    resetPublicationManagementQueryState();
  });
}

export function publicationManagementQueryRows(author = "author", role = "user") {
  publicationManagementQueryState.rows = [
    [["content", "published"]],
    [["comment", "Original", author]],
    [[role]],
  ];
}
