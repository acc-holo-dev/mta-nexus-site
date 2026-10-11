import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  snapshots: [] as unknown[],
}));
vi.mock("../packages/db/src/repositories/publication-notice", () => ({
  publicationNotice: vi.fn(),
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (work: (tx: typeof database) => unknown, options?: unknown) => {
            state.snapshots.push(options);
            return work(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { serverContentRepository as repository } from "../packages/db/src/repositories/server-content";
import { authorContentRepository } from "../packages/db/src/repositories/author-content";
import { content } from "../packages/db/src/schema";
const time = "2026-10-11T00:00:00.000Z";
const row = (extra: Record<string, unknown> = {}) =>
  Object.keys(getTableColumns(content)).map(
    (key) =>
      (
        ({
          id: "item",
          authorId: "writer",
          serverId: "srv",
          organizationId: null,
          slug: "original",
          title: "Original",
          body: "Original publication",
          type: "article",
          status: "published",
          tags: [],
          createdAt: time,
          updatedAt: time,
          commentCount: 4,
          ...extra,
        }) as Record<string, unknown>
      )[key] ?? null,
  );
const fields = {
  title: "Edited",
  body: "A useful publication body",
  tags: ["Lua"],
  excerpt: "",
  coverImageUrl: "",
};
const audit = {
  id: "audit",
  actorId: "actor",
  actorType: "user" as const,
  targetId: "item",
  targetType: "content",
  action: "content.edited_by_server",
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.snapshots = [];
});
it("reads all authors in the same live-access snapshot with bounded filters and no private columns", async () => {
  state.rows = [[["srv", "Server", "server"]], []];
  await repository.page("srv", "actor", { page: 2, query: "%_", status: "draft", type: "news" });
  expect(state.snapshots).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries[0].sql).toContain('"users"."role" =');
  expect(state.queries[0].params).not.toContain("owner");
  expect(state.queries[1].params).toEqual(["srv", "draft", "news", "%\\%\\_%", "%\\%\\_%", 21, 20]);
  expect(state.queries[1].sql.split(" from ")[0]).not.toMatch(/body|password|email/u);
  expect(state.queries[1].sql).not.toContain('"content"."author_id" =');
});
it("does not query drafts without current access and rejects foreign-server detail", async () => {
  await expect(repository.get("srv", "actor", "foreign")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(1);
  state.rows = [[["srv", "Server", "server"]], []];
  await expect(repository.get("srv", "actor", "foreign")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries.at(-1)?.params).toEqual(["foreign", "srv", 1]);
});
it("uses the shared content-first versioned edit without replacing attribution, slug, context or counters", async () => {
  state.rows = [
    [row()],
    [["srv", "Server", "server", "actor", null]],
    [["user"]],
    [row({ status: "draft", updatedAt: "2026-10-11T00:00:00.001Z" })],
  ];
  expect(
    await authorContentRepository.mutate(
      "item",
      "actor",
      new Date(time),
      "published",
      fields,
      audit,
      undefined,
      "srv",
    ),
  ).toMatchObject({ authorId: "writer", serverId: "srv", commentCount: 4, status: "draft" });
  expect(state.queries[0].params).toEqual(["item", "srv", 1]);
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("for share");
  const set = state.queries
    .find((q) => q.sql.startsWith("update"))
    ?.sql.split(" set ")[1]
    .split(" where ")[0];
  expect(set).not.toMatch(/author_id|slug|server_id|organization_id|product_id|comment_count/u);
});
it.each(["owner", "member", "developer", "moderator"])(
  "denies revoked, stale or undelegated team authority %s",
  async (role) => {
    state.rows = [
      [row()],
      [["srv", "Server", "server", null, "org"]],
      [["user"]],
      [["actual-owner"]],
      [[role, role === "owner" ? ["manage_servers"] : []]],
    ];
    await expect(
      authorContentRepository.mutate(
        "item",
        "actor",
        new Date(time),
        "published",
        fields,
        audit,
        undefined,
        "srv",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries.some((q) => /^(update|insert)/u.test(q.sql))).toBe(false);
  },
);
it("rechecks server management even through the original author's legacy editor", async () => {
  state.rows = [
    [row({ authorId: "actor" })],
    [["srv", "Server", "server", "new-owner", null]],
    [["user"]],
  ];
  await expect(
    authorContentRepository.mutate("item", "actor", new Date(time), "published", fields, audit),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
});
it("allows delegated server creation and forces current server context, actor, review and empty counters", async () => {
  state.rows = [
    [["srv", "Server", "server", null, "org"]],
    [["user"]],
    [["owner"]],
    [["member", ["manage_servers"]]],
    [row({ authorId: "actor", organizationId: "org", status: "draft" })],
  ];
  await repository.create(
    "srv",
    "actor",
    {
      ...fields,
      id: "item",
      slug: "new",
      authorId: "victim",
      serverId: "foreign",
      organizationId: "foreign-org",
      type: "article",
      status: "published",
      commentCount: 10,
      viewCount: 2,
      likeCount: 3,
    },
    audit,
  );
  const insert = state.queries.find((q) => q.sql.startsWith('insert into "content"'));
  expect(insert?.params).toContain("srv");
  expect(insert?.params).toContain("org");
  expect(insert?.params).toContain("draft");
  expect(insert?.params).not.toContain("victim");
  expect(insert?.params).not.toContain("foreign");
  expect(insert?.params).not.toContain("foreign-org");
});
