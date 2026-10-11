import { beforeEach, expect, it, vi } from "vitest";
import { parseDiscussionQuery } from "../apps/web/src/lib/content-discussion-contract";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options?: unknown) => {
            state.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { contentDiscussionRepository as discussion } from "../packages/db/src/repositories/content-discussion";
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
});
it("validates focused comment identity and rejects mixed or injected filters", () => {
  expect(parseDiscussionQuery(new URLSearchParams({ comment: "comment" }))).toEqual({
    query: "",
    focusId: "comment",
    cursor: undefined,
  });
  for (const query of [
    "?comment=a&comment=b",
    "?comment=a&q=Lua",
    "?comment=a&cursor=bad",
    "?comment=a/b",
    "?actorId=victim",
    "?q=Lua&q=SQL",
    `?q=${"x".repeat(121)}`,
    "?q=Lua%00SQL",
  ])
    expect(parseDiscussionQuery(new URLSearchParams(query))).toBeNull();
});
it("binds search continuations to a query and preserves exact microseconds", () => {
  const cursor = {
    id: "comment",
    createdAt: "2026-10-11T00:00:00.123456Z",
    contentId: "content",
    query: "Lua",
  };
  expect(
    parseDiscussionQuery(new URLSearchParams({ q: " Lua ", cursor: JSON.stringify(cursor) }))
      ?.cursor,
  ).toEqual(cursor);
  expect(
    parseDiscussionQuery(new URLSearchParams({ q: "SQL", cursor: JSON.stringify(cursor) })),
  ).toBeNull();
  expect(
    parseDiscussionQuery(
      new URLSearchParams({
        q: "Lua",
        cursor: JSON.stringify({ id: cursor.id, createdAt: cursor.createdAt }),
      }),
    ),
  ).toBeNull();
});
it("searches comment text and public author names with escaped patterns before the bounded keyset limit", async () => {
  await discussion.page(
    "content",
    { createdAt: "2026-10-11T00:00:00.123456Z", id: "last" },
    { query: "%_" },
  );
  const query = state.queries[0];
  expect(query.params).toEqual([
    "published",
    "content",
    "%\\%\\_%",
    "%\\%\\_%",
    "%\\%\\_%",
    "2026-10-11T00:00:00.123456Z",
    "last",
    21,
  ]);
  expect(query.sql).toContain('"users"."username" ilike');
  expect(query.sql).toContain('"comments"."product_id" is null');
  expect(query.sql).not.toMatch(/email|password/u);
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
});
it("loads a focused comment and older context in the same read snapshot, scoped to published content at microsecond precision", async () => {
  state.rows = [[["focus", "2026-10-11T00:00:00.123456Z"]], []];
  await discussion.page("content", undefined, { focusId: "focus" });
  expect(state.queries[0].params).toEqual(["published", "focus", "content", 1]);
  expect(state.queries[0].sql).toContain('"comments"."product_id" is null');
  expect(state.queries[1].params).toEqual([
    "published",
    "content",
    "2026-10-11T00:00:00.123456Z",
    "focus",
    21,
  ]);
  expect(state.queries[1].sql).toContain("<=");
  expect(state.queries[1].sql).toContain('left("parent_comment"."text", 160)');
});
it("does not return a foreign, removed or unpublished focused comment", async () => {
  await expect(discussion.page("content", undefined, { focusId: "foreign" })).rejects.toMatchObject(
    { code: "COMMENT_FOCUS_NOT_FOUND", statusCode: 404 },
  );
  expect(state.queries).toHaveLength(1);
});
