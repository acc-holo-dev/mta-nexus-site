import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
  notice: vi.fn(),
}));
vi.mock("../packages/db/src/repositories/discussion-moderation-notice", () => ({
  discussionModerationNotice: state.notice,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
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
});

import { communityModerationWorkspaceRepository as repo } from "../packages/db/src/repositories/community-moderation-workspace";

const time = "2026-10-11T00:00:00.123456Z",
  publication = ["post", "Private", "guide", "post", "archived"];
const filters = { query: "%_", view: "pending" as const, type: "spam" };
const rows = () => [
  [["moderator"]],
  [publication],
  [["comment"]],
  Array.from({ length: 21 }, (_, i) => [`report-${i}`, "spam", "Reason", "open", time, null, time]),
];
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.config = null;
});
it("reads twenty related reports from a proven private comment, with exact keyset and no personal or staff fields", async () => {
  state.rows = rows();
  const page = await repo.discussionReports("staff", "post", "comment", filters);
  expect(page.items).toHaveLength(20);
  expect(page.nextCursor).toEqual({ createdAt: time, id: "report-19" });
  expect(page.removed).toBe(false);
  if (!page.nextCursor) throw Error("Missing continuation");
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries[2].params).toEqual(["comment", "post", 1]);
  expect(state.queries[2].sql).toContain('"comments"."product_id" is null');
  const query = state.queries[3];
  expect(query.params).toEqual(
    expect.arrayContaining(["comment", "spam", "open", "under_review", "%\\%\\_%", 21]),
  );
  expect(query.sql).toContain('left("reason",1000)');
  expect(query.sql).toContain('order by "reports"."created_at" desc, "reports"."id" desc');
  expect(query.sql).not.toMatch(/offset|reporter_id|moderator_notes|email|evidence_urls/u);
  state.rows = [[["moderator"]], [publication], [["comment"]], []];
  state.queries = [];
  await repo.discussionReports("staff", "post", "comment", {
    ...filters,
    cursor: { ...page.nextCursor, context: page.context },
  });
  expect(state.queries[3].sql).toContain(") < (");
  expect(state.queries[3].params).toContain(time);
});
it.each(["actor", "publication", "comment", "query", "view", "type"])(
  "rejects cursor context substitution (%s) after live staff and publication checks",
  async (changed) => {
    state.rows = rows();
    const page = await repo.discussionReports("staff", "post", "comment", filters);
    if (!page.nextCursor) throw Error("Missing continuation");
    state.queries = [];
    state.rows = [[["moderator"]], [publication]];
    await expect(
      repo.discussionReports(
        changed === "actor" ? "foreign" : "staff",
        changed === "publication" ? "foreign" : "post",
        changed === "comment" ? "foreign" : "comment",
        {
          ...filters,
          query: changed === "query" ? "new" : filters.query,
          view: changed === "view" ? "history" : "pending",
          type: changed === "type" ? "abuse" : filters.type,
          cursor: { ...page.nextCursor, context: page.context },
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(2);
  },
);
it("preserves separate pending decisions after deletion, only with retained same-publication removal proof", async () => {
  state.rows = [
    [["admin"]],
    [publication],
    [],
    [["proof"]],
    [["report", "spam", "Other reason", "under_review", time, null, time]],
  ];
  const page = await repo.discussionReports("staff", "post", "comment", {
    query: "",
    view: "pending",
  });
  expect(page.removed).toBe(true);
  expect(page.items[0].status).toBe("under_review");
  expect(state.queries[3].params).toEqual(
    expect.arrayContaining(["comment", "content.comment_removed", "post"]),
  );
  expect(state.queries.some((query) => /^(insert|update|delete)/u.test(query.sql))).toBe(false);
  state.queries = [];
  state.rows = [[["admin"]], [publication], [], []];
  await expect(
    repo.discussionReports("staff", "post", "foreign", { query: "", view: "history" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(4);
});
it("rejects revoked live staff authority before any private target read", async () => {
  state.rows = [[["user"]]];
  await expect(
    repo.discussionReports("staff", "post", "comment", { query: "", view: "pending" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.queries).toHaveLength(1);
});
