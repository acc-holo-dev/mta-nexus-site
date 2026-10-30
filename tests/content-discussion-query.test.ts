import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { comments } from "../packages/db/src/schema";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
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
          return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { contentRepository } from "../packages/db/src/repositories/content";
import { contentDiscussionRepository } from "../packages/db/src/repositories/content-discussion";

const data = {
  id: "cmt",
  contentId: "content",
  authorId: "author",
  text: "Reply",
  isVerifiedPurchase: false,
  parentId: "parent",
};
const audit = {
  id: "audit",
  actorId: "author",
  actorType: "user" as const,
  action: "content.comment_added",
  targetId: "content",
  targetType: "content",
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
});
it("scopes published discussions and parent context without private user fields", async () => {
  await contentDiscussionRepository.page("content", {
    createdAt: "2026-10-10T12:00:00.000123Z",
    id: "last",
  });
  const query = state.queries[0];
  expect(query.sql).toContain('"content"."status" =');
  expect(query.params).toEqual(["published", "content", "2026-10-10T12:00:00.000123Z", "last", 21]);
  expect(query.sql).toContain('"comments"."product_id" is null');
  expect(query.sql).toContain('order by "comments"."created_at" desc, "comments"."id" desc');
  expect(query.sql).toContain("::timestamptz");
  expect(query.sql).toContain('left("parent_comment"."text", 160)');
  expect(query.sql).not.toMatch(/email|password_hash|rating_count/u);
});
it("preserves microseconds and uses the last visible row as the next cursor", async () => {
  state.rows = [
    Array.from({ length: 21 }, (_, i) => [
      `cmt_${i}`,
      "content",
      "Reply",
      null,
      "2026-10-10T12:00:00.000Z",
      "2026-10-10T12:00:00.000123Z",
      "user",
      "user",
      "User",
      null,
      null,
      null,
    ]),
  ];
  const result = await contentDiscussionRepository.page("content");
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toEqual({ id: "cmt_19", createdAt: "2026-10-10T12:00:00.000123Z" });
  expect(result.hasMore).toBe(true);
});
it("searches public text and author names with literal wildcard escaping before limiting", async () => {
  await contentDiscussionRepository.page("content", undefined, { query: "%_" });
  expect(state.queries[0].params).toEqual([
    "published",
    "content",
    "%\\%\\_%",
    "%\\%\\_%",
    "%\\%\\_%",
    21,
  ]);
  expect(state.queries[0].sql).toContain('"comments"."text" ilike');
  expect(state.queries[0].sql).toContain('"users"."username" ilike');
  expect(state.queries[0].sql).not.toMatch(/email|password_hash/u);
});
it("anchors focused pages to a public comment in the exact discussion using its precise stored timestamp", async () => {
  state.rows = [[["older", "2026-10-11T00:00:00.000123Z"]], []];
  await contentDiscussionRepository.page("content", undefined, { focusId: "older" });
  expect(state.queries[0].params).toEqual(["published", "older", "content", 1]);
  expect(state.queries[1].params).toEqual([
    "published",
    "content",
    "2026-10-11T00:00:00.000123Z",
    "older",
    21,
  ]);
  expect(state.queries[1].sql).toContain("<=");
});
it("rejects an unavailable focus before reading unrelated comment rows", async () => {
  await expect(
    contentDiscussionRepository.page("content", undefined, { focusId: "missing" }),
  ).rejects.toMatchObject({ code: "COMMENT_FOCUS_NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
});
it.each(["draft", "archived"])(
  "rejects a %s target inside the persistence transaction",
  async (status) => {
    state.rows = [[[status]]];
    await expect(contentRepository.addComment(data, audit)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(state.queries[0].sql).toContain("for update");
    expect(state.queries).toHaveLength(1);
  },
);
it("rejects missing/cross-target parents before inserting", async () => {
  state.rows = [[["published"]], []];
  await expect(contentRepository.addComment(data, audit)).rejects.toMatchObject({
    code: "COMMENT_PARENT_NOT_FOUND",
  });
  expect(state.queries[1].params).toEqual(["parent", "content", 1]);
  expect(state.queries[1].sql).toContain('"comments"."product_id" is null');
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries).toHaveLength(2);
});
it("inserts a reply, changes only the count and audits under the publication lock", async () => {
  const stored = { ...data, createdAt: "2026-10-10T12:00:00.000Z", productId: null, rating: null };
  const row = Object.keys(getTableColumns(comments)).map(
    (key) => stored[key as keyof typeof stored] ?? null,
  );
  state.rows = [[["published"]], [["parent"]], [row], [], [], []];
  const result = await contentRepository.addComment(data, audit);
  expect(result.id).toBe("cmt");
  expect(state.queries[0].sql).toContain("for update");
  const update = state.queries[3].sql;
  expect(update).toContain('"comment_count" = "content"."comment_count" + 1');
  expect(update).not.toContain('"updated_at"');
  expect(state.queries[4].sql).toContain('insert into "discussion_notification_deliveries"');
  expect(state.queries[5].sql).toContain('insert into "audit_events"');
});
