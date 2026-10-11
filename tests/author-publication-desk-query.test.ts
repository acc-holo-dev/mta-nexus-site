import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { content } from "../packages/db/src/schema";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: [] as unknown[],
  notice: vi.fn(),
  serverAccess: vi.fn(),
  failAudit: false,
}));
vi.mock("../packages/db/src/repositories/publication-notice", () => ({
  publicationNotice: state.notice,
}));
vi.mock("../packages/db/src/repositories/server-content", () => ({
  serverContentAccess: state.serverAccess,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
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
});

import { authorContentRepository as repo } from "../packages/db/src/repositories/author-content";
import { publicationFeedRepository as feed } from "../packages/db/src/repositories/publication-feed";

const revision = "2026-10-11T00:00:00.123456Z",
  next = "2026-10-11T00:00:00.124456Z";
const filters = { query: "", tag: "", type: "all", status: "all", source: "all" };
const context = createHash("sha256")
  .update(JSON.stringify([1, "author-publication-desk", "actor", "", "", "all", "all", "all"]))
  .digest("hex");
const fixture: Record<string, unknown> = {
  id: "article",
  slug: "article",
  title: "Title",
  body: "A complete publication",
  authorId: "actor",
  type: "article",
  status: "archived",
  tags: [],
  createdAt: revision,
  updatedAt: revision,
  viewCount: 10,
  likeCount: 2,
  commentCount: 3,
};
const full = (overrides: Record<string, unknown> = {}, exact = revision) => [
  ...Object.keys(getTableColumns(content)).map(
    (key) => ({ ...fixture, ...overrides })[key] ?? null,
  ),
  exact,
];
const audit = {
  id: "audit",
  actorId: "actor",
  actorType: "user" as const,
  action: "content.restored_by_author",
  targetId: "article",
  targetType: "content",
};
const summary = (id: string) => [
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
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
  state.notice.mockReset();
  state.serverAccess.mockReset();
  state.failAudit = false;
});
it("returns a bounded private keyset desk without commercial rows, body, offset or account fields", async () => {
  state.rows = [Array.from({ length: 21 }, (_, n) => summary(`article_${21 - n}`))];
  const page = await repo.desk("actor", filters);
  expect(page.items).toHaveLength(20);
  expect(JSON.parse(page.olderCursor ?? "")).toMatchObject({
    id: "article_2",
    createdAt: revision,
    context,
    direction: "older",
  });
  expect(page.newerCursor).toBeNull();
  expect(state.queries).toHaveLength(1);
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const query = state.queries[0];
  expect(query.sql).not.toContain("offset");
  expect(query.sql).toContain('order by "content"."updated_at" desc, "content"."id" desc');
  expect(query.params).toContain("actor");
  expect(query.params).toContain(21);
  expect(query.params).not.toContain("resource");
  expect(query.sql.split(" from ")[0]).not.toContain('"content"."body",');
  expect(query.sql).not.toContain('"users"');
  expect(query.sql).toContain("restoreRevision");
  expect(query.sql).toContain("staff_archive");
});
it("escapes literal full-text search, exact tags and binds all filters before the row limit", async () => {
  await repo.desk("actor_'", {
    query: "%_\\",
    tag: "LuA",
    status: "draft",
    type: "news",
    source: "organization",
  });
  const query = state.queries[0];
  expect(query.params).toEqual(
    expect.arrayContaining(["actor_'", "draft", "news", "organization", "lua", "%\\%\\_\\\\%", 21]),
  );
  expect(query.sql).not.toContain("actor_'");
  expect(query.sql).toContain("jsonb_array_elements_text");
  expect(query.sql).toContain('left join "servers"');
  expect(query.params).toEqual(expect.arrayContaining(["public", "active"]));
});
it("selects nearest newer rows before reversing and needs no anchor lookup", async () => {
  state.rows = [[summary("near"), summary("latest")]];
  const page = await repo.desk("actor", {
    ...filters,
    cursor: { id: "removed", createdAt: revision, context, direction: "newer" },
  });
  expect(page.items.map((item) => item.id)).toEqual(["latest", "near"]);
  expect(page.newerCursor).toBeNull();
  expect(page.olderCursor).not.toBeNull();
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).toContain(") > (");
  expect(state.queries[0].sql).toContain('"updated_at" asc, "content"."id" asc');
});
it.each(["actor", "status", "source", "tag"])(
  "rejects desk context changes (%s) before SQL",
  async (changed) => {
    await expect(
      repo.desk(changed === "actor" ? "foreign" : "actor", {
        ...filters,
        status: changed === "status" ? "draft" : "all",
        source: changed === "source" ? "server" : "all",
        tag: changed === "tag" ? "lua" : "",
        cursor: { id: "last", createdAt: revision, context, direction: "older" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(0);
  },
);
it("checks authored scope before querying retained history and selects no private staff information", async () => {
  await expect(repo.history("article", "foreign")).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].params).toContain("foreign");
  state.queries = [];
  state.rows = [
    [["article", "Title", "archived", revision, false]],
    Array.from({ length: 21 }, (_, n) => [
      `audit_${n}`,
      "content.archived",
      revision,
      "published",
      "archived",
    ]),
  ];
  const page = await repo.history("article", "actor");
  expect(page.events).toHaveLength(20);
  expect(page.olderCursor).not.toBeNull();
  expect(state.queries).toHaveLength(2);
  const selected = state.queries[1].sql.split(" from ")[0];
  expect(selected).not.toMatch(/notes|actor_id|ip_address|user_agent/u);
  expect(state.queries[1].params).toContain("article");
  expect(state.queries[1].params).toContain(21);
});
it("locks the author row first and restores only a proven version to a private draft", async () => {
  state.rows = [[full()], [["article"]], [full({ status: "draft", publishedAt: null }, next)], []];
  expect(await repo.restore("article", "actor", revision, audit)).toEqual({
    id: "article",
    status: "draft",
    revision: next,
  });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[0].params).toEqual(expect.arrayContaining(["article", "actor", "article"]));
  expect(state.queries[1].sql).toContain("restoreRevision");
  expect(state.queries[1].sql).toContain("content.archived_by_author");
  expect(state.queries[1].sql).toContain("staff_archive");
  const set = state.queries[2].sql.split(" set ")[1].split(" where ")[0];
  expect(set).toContain('"status"');
  expect(set).toContain('"published_at"');
  expect(set).not.toMatch(/body|slug|title|view_count|like_count|comment_count/u);
  expect(state.queries[3].params).toContain("content.restored_by_author");
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: "article", status: "draft" }),
    "actor",
    "restored",
    "audit",
  );
});
it.each([
  { row: full({ status: "published" }), code: "CONFLICT", queries: 1 },
  { row: full({}, next), code: "CONFLICT", queries: 1 },
  { row: full(), code: "PUBLICATION_RESTORE_DENIED", queries: 2 },
])(
  "rejects stale states or unproven archives before writes ($code)",
  async ({ row, code, queries }) => {
    state.rows = [[row], []];
    await expect(repo.restore("article", "actor", revision, audit)).rejects.toMatchObject({ code });
    expect(state.queries).toHaveLength(queries);
    expect(state.notice).not.toHaveBeenCalled();
  },
);
it.each([null, "member", "owner"])(
  "rechecks revoked organizational rights under shared locks (%s)",
  async (role) => {
    state.rows = [
      [full({ organizationId: "org" })],
      [["article"]],
      [["different-owner"]],
      role ? [[role]] : [],
    ];
    await expect(repo.restore("article", "actor", revision, audit)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(state.queries.at(-1)?.sql).toContain("for share");
    expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
  },
);
it("reuses server delegation authority and propagates mandatory audit/notice failures", async () => {
  state.rows = [[full({ serverId: "server" })], [["article"]]];
  state.serverAccess.mockRejectedValueOnce(new Error("revoked"));
  await expect(repo.restore("article", "actor", revision, audit)).rejects.toThrow("revoked");
  expect(state.serverAccess).toHaveBeenCalledWith(expect.anything(), "server", "actor");
  expect(state.queries).toHaveLength(2);
  state.rows = [[full()], [["article"]], [full({ status: "draft" }, next)]];
  state.failAudit = true;
  await expect(repo.restore("article", "actor", revision, audit)).rejects.toMatchObject({
    cause: { message: "audit failed" },
  });
  state.failAudit = false;
  state.rows = [[full()], [["article"]], [full({ status: "draft" }, next)], []];
  state.notice.mockRejectedValueOnce(new Error("notice failed"));
  await expect(repo.restore("article", "actor", revision, audit)).rejects.toThrow("notice failed");
});
it("records exact recovery proof only for a new author archive and keeps private proof out of the content response", async () => {
  state.rows = [[full({ status: "published" }).slice(0, -1)], [full({}, next)], []];
  const result = await repo.mutate("article", "actor", new Date(revision), "published", null, {
    ...audit,
    action: "content.archived_by_author",
  });
  expect(result).not.toHaveProperty("archiveRevision");
  expect(state.queries[2].params).toContain(
    JSON.stringify({ from: "published", to: "archived", restoreRevision: next }),
  );
});
it.each(["user", "organization", "server"] as const)(
  "binds exact followed %s target within the current actor's subscription subquery",
  async (source) => {
    await feed.page({ kind: "following", actorId: "actor" }, { source, target: "selected" });
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].params).toEqual(
      expect.arrayContaining(["actor", source, "selected", 21]),
    );
    expect(state.queries[0].sql).toContain('"follows"."target_id" =');
    expect(state.queries[0].sql).not.toContain("offset");
  },
);
