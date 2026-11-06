import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { content } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for author-publication-desk-query suites. */
export const authorPublicationDeskQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: [] as unknown[],
  notice: vi.fn(),
  serverAccess: vi.fn(),
  failAudit: false,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createAuthorPublicationDeskQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = authorPublicationDeskQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw Error("audit failed");
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options: unknown) => {
            state.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetAuthorPublicationDeskQueryState() {
  const state = authorPublicationDeskQueryState;
  state.queries = [];
  state.rows = [];
  state.options = [];
  state.notice.mockReset();
  state.serverAccess.mockReset();
  state.failAudit = false;
}

export function installAuthorPublicationDeskQueryHooks() {
  beforeEach(() => {
    resetAuthorPublicationDeskQueryState();
  });
}

export const authorPublicationDeskQueryRevision = "2026-10-11T00:00:00.123456Z";
export const authorPublicationDeskQueryNext = "2026-10-11T00:00:00.124456Z";

export const authorPublicationDeskQueryFilters = {
  query: "",
  tag: "",
  type: "all",
  status: "all",
  source: "all",
};

export const authorPublicationDeskQueryContext = createHash("sha256")
  .update(JSON.stringify([1, "author-publication-desk", "actor", "", "", "all", "all", "all"]))
  .digest("hex");

const authorPublicationDeskQueryFixture: Record<string, unknown> = {
  id: "article",
  slug: "article",
  title: "Title",
  body: "A complete publication",
  authorId: "actor",
  type: "article",
  status: "archived",
  tags: [],
  createdAt: authorPublicationDeskQueryRevision,
  updatedAt: authorPublicationDeskQueryRevision,
  viewCount: 10,
  likeCount: 2,
  commentCount: 3,
};

export function authorPublicationDeskQueryFull(
  overrides: Record<string, unknown> = {},
  exact = authorPublicationDeskQueryRevision,
) {
  return [
    ...Object.keys(getTableColumns(content)).map(
      (key) => ({ ...authorPublicationDeskQueryFixture, ...overrides })[key] ?? null,
    ),
    exact,
  ];
}

export const authorPublicationDeskQueryAudit = {
  id: "audit",
  actorId: "actor",
  actorType: "user" as const,
  action: "content.restored_by_author",
  targetId: "article",
  targetType: "content",
};

export function authorPublicationDeskQuerySummary(id: string) {
  const revision = authorPublicationDeskQueryRevision;
  return [
    id,
    id,
    "Title",
    "article",
    "archived",
    "Excerpt",
    revision,
    revision,
    3,
    "personal",
    null,
    null,
    null,
    null,
    true,
    ["lua"],
  ];
}
