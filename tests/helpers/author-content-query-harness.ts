import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { content, users } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for author-content-query suites. */
export const authorContentQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createAuthorContentQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = authorContentQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        // SQL and serialization coverage; this adapter does not prove PostgreSQL locking or rollback.
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetAuthorContentQueryState() {
  authorContentQueryState.queries = [];
  authorContentQueryState.rows = [];
}

export function installAuthorContentQueryHooks() {
  beforeEach(() => {
    resetAuthorContentQueryState();
  });
}

export const authorContentQueryVersion = new Date("2026-10-10T12:00:00.000Z");

export const authorContentQueryFixture = {
  id: "cnt_1",
  authorId: "usr_1",
  title: "Title",
  slug: "my-article",
  body: "A sufficiently long body",
  excerpt: "",
  coverImageUrl: null,
  tags: [],
  type: "article",
  status: "published",
  organizationId: null,
  createdAt: authorContentQueryVersion.toISOString(),
  updatedAt: authorContentQueryVersion.toISOString(),
  publishedAt: authorContentQueryVersion.toISOString(),
  viewCount: 99,
  likeCount: 3,
  commentCount: 10,
};

export function authorContentQueryRow(overrides: Record<string, unknown> = {}) {
  return Object.keys(getTableColumns(content)).map(
    (key) =>
      ({ ...authorContentQueryFixture, ...overrides })[
        key as keyof typeof authorContentQueryFixture
      ] ?? null,
  );
}

export const authorContentQueryFields = {
  title: "Edited title",
  body: "A complete edited body.",
  tags: ["lua"],
  excerpt: "",
  coverImageUrl: "",
};

export const authorContentQueryAudit = {
  id: "aud_1",
  actorId: "usr_1",
  actorType: "user" as const,
  action: "content.edited_by_author",
  targetId: "cnt_1",
  targetType: "content",
};

export function authorContentQueryUserColumns(fixture: Record<string, unknown>) {
  return Object.keys(getTableColumns(users))
    .filter((key) => key !== "passwordHash")
    .map((key) => fixture[key] ?? null);
}
