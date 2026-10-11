import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  rows: [] as unknown[][][],
  queries: [] as { sql: string; params: unknown[] }[],
  transactions: [] as unknown[],
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
          return (work: (tx: typeof database) => unknown, options: unknown) => {
            state.transactions.push(options);
            return work(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { publicDirectoryRepository as directory } from "../packages/db/src/repositories/public-directory";
import { communityModerationWorkspaceRepository as moderation } from "../packages/db/src/repositories/community-moderation-workspace";
const time = "2026-10-11T00:00:00.123456Z";
const context = (parts: unknown[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.transactions = [];
});
it.each(["pageServers", "pageCreators", "pageOrganizations"] as const)(
  "%s retains existing public gates, escaping and bounded keyset predicates without offset",
  async (method) => {
    await directory[method]({
      keyset: true,
      query: "%_",
      verified: true,
      language: "ru",
      region: "EU",
      gameMode: "RP",
      cursor: { createdAt: time, id: "anchor" },
    });
    const query = state.queries[0];
    expect(query.sql).not.toContain("offset");
    expect(query.sql).toContain("US");
    expect(query.sql).toMatch(/\) < \(/u);
    expect(query.params).toEqual(expect.arrayContaining(["%\\%\\_%", time, "anchor", true, 25]));
    expect(query.sql.split(" from ")[0]).not.toMatch(
      /owner_id|organization_id|email|password|current_players|endpoint_revision/u,
    );
    if (method === "pageServers")
      expect(query.params).toEqual(
        expect.arrayContaining(["public", "active", "%ru%", "%EU%", "%RP%"]),
      );
    if (method === "pageCreators")
      expect(query.params).toEqual(expect.arrayContaining(["developer", "admin"]));
  },
);
it("returns twenty-four exact tied keys and strips internal time fields from public identity rows", async () => {
  state.rows = [
    Array.from({ length: 25 }, (_, i) => [
      `user-${i}`,
      `user${i}`,
      "User",
      null,
      null,
      false,
      time,
    ]),
  ];
  const page = await directory.pageCreators({ keyset: true });
  expect(page.items).toHaveLength(24);
  expect(page.hasMore).toBe(true);
  expect(page.nextCursor).toEqual({ createdAt: time, id: "user-23" });
  expect(page.previousCursor).toBeNull();
  expect(JSON.stringify(page.items)).not.toContain("cursorTime");
});
it("queries the nearest newer neighbors ascending and restores descending display order", async () => {
  state.rows = [
    Array.from({ length: 25 }, (_, i) => [`org-${i}`, "Team", `team-${i}`, null, null, true, time]),
  ];
  const page = await directory.pageOrganizations({
    keyset: true,
    cursor: { createdAt: time, id: "anchor", direction: "newer" },
  });
  expect(state.queries[0].sql).toMatch(/\) > \(/u);
  expect(state.queries[0].sql).toMatch(/created_at.+asc.+id.+asc/u);
  expect(page.items[0].id).toBe("org-23");
  expect(page.nextCursor?.id).toBe("org-0");
  expect(page.previousCursor?.id).toBe("org-23");
});
it("does not emit continuation on an empty stream page", async () => {
  const page = await directory.pageCreators({
    keyset: true,
    cursor: { createdAt: time, id: "gone" },
  });
  expect(page).toMatchObject({ items: [], hasMore: false, nextCursor: null, previousCursor: null });
});
it.each(["user", "developer", null])(
  "checks current staff role %s before reading any moderation content",
  async (role) => {
    state.rows = [role ? [[role]] : []];
    await expect(moderation.page("actor", { query: "" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(state.queries).toHaveLength(1);
  },
);
it("reads only supported publication types after staff and scopes the exact microsecond queue to filters", async () => {
  state.rows = [
    [["moderator"]],
    Array.from({ length: 21 }, (_, i) => [
      `item-${i}`,
      `post-${i}`,
      "Draft",
      "post",
      "draft",
      "Preview",
      time,
      time,
      "writer",
      "Writer",
      null,
      time,
    ]),
  ];
  const point = context([1, "community-moderation", "actor", "%_", "draft", "post", "writer"]);
  const page = await moderation.page("actor", {
    query: "%_",
    status: "draft",
    type: "post",
    author: "Writer",
    cursor: { createdAt: time, id: "anchor", context: point },
  });
  expect(page.items).toHaveLength(20);
  expect(page.nextCursor).toEqual({ createdAt: time, id: "item-19" });
  expect(state.queries[1].params).toEqual(
    expect.arrayContaining(["draft", "post", "writer", "%\\%\\_%", time, "anchor", 21]),
  );
  expect(state.queries[1].sql).not.toMatch(/offset|product_id|email|password|owner_id/u);
  expect(state.queries[1].sql).toContain("350");
  expect(state.transactions).toEqual([
    { isolationLevel: "repeatable read", accessMode: "read only" },
  ]);
});
it.each(["page", "detail"] as const)(
  "rejects foreign %s cursors before publication or history access",
  async (mode) => {
    state.rows = [[["admin"]]];
    const cursor = { createdAt: time, id: "anchor", context: "a".repeat(64) };
    await expect(
      mode === "page"
        ? moderation.page("actor", { query: "", cursor })
        : moderation.detail("actor", "item", cursor),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(1);
  },
);
it("masks missing/nonpublication detail and reads no audit history", async () => {
  state.rows = [[["admin"]], []];
  await expect(moderation.detail("actor", "commercial")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(2);
});
it("reads a bounded full preview and only retained publication decisions without raw audit or account data", async () => {
  state.rows = [
    [["moderator"]],
    [
      [
        "item",
        "draft",
        "Draft",
        "article",
        "draft",
        "Preview",
        time,
        time,
        "writer",
        "Writer",
        null,
        "Full draft body",
        false,
        ["Lua"],
        "Team",
        "team",
        null,
        null,
      ],
    ],
    [["audit", "content.archived", time, time, "published", "archived", "Private staff reason"]],
  ];
  const page = await moderation.detail("actor", "item");
  expect(page.item.body).toBe("Full draft body");
  expect(page.history[0].notes).toBe("Private staff reason");
  expect(state.queries[1].sql).toContain("100000");
  expect(state.queries[1].params).toEqual(expect.arrayContaining(["public", "active", "item"]));
  expect(state.queries[2].params).toEqual([
    "content",
    "item",
    "content.published",
    "content.archived",
    21,
  ]);
  expect(state.queries[2].sql).not.toMatch(/ip_address|user_agent|actor_id|reviewer_id/u);
  expect(state.queries[2].sql).toContain("2000");
  expect(page.nextCursor).toBeNull();
});
