import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: [] as unknown[],
  failAudit: false,
}));
vi.mock("../packages/db/src/repositories/publication-notice", () => ({ publicationNotice: vi.fn() }));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failure");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options?: unknown) => {
            state.transactions.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { organizationContentRepository as team } from "../packages/db/src/repositories/organization-content";
import { authorContentRepository as author } from "../packages/db/src/repositories/author-content";
import { contentRepository } from "../packages/db/src/repositories/content";
import { content, organizations } from "../packages/db/src/schema";
const time = "2026-10-11T00:00:00.000Z",
  later = "2026-10-11T00:00:00.001Z";
const org = (ownerId = "actor") =>
  Object.keys(getTableColumns(organizations)).map(
    (key) =>
      (
        ({
          id: "org",
          ownerId,
          name: "Team",
          slug: "team",
          createdAt: time,
          updatedAt: time,
        }) as Record<string, unknown>
      )[key] ?? null,
  );
const publication = (extra: Record<string, unknown> = {}) =>
  Object.keys(getTableColumns(content)).map(
    (key) =>
      (
        ({
          id: "content",
          authorId: "original",
          organizationId: "org",
          type: "article",
          status: "published",
          slug: "published",
          title: "Original",
          body: "Original publication",
          tags: [],
          updatedAt: time,
          createdAt: time,
          publishedAt: time,
          commentCount: 4,
          ...extra,
        }) as Record<string, unknown>
      )[key] ?? null,
  );
const fields = {
  title: "New title",
  body: "New publication text",
  tags: ["Lua"],
  excerpt: "",
  coverImageUrl: "",
};
const audit = {
  id: "audit",
  actorId: "actor",
  actorType: "user" as const,
  targetType: "content",
  targetId: "content",
  action: "content.edited_by_organization",
  details: { organizationId: "org" },
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.transactions = [];
  state.failAudit = false;
});
const writes = () => state.queries.filter((q) => /^(insert|update|delete)/u.test(q.sql));
it("authorizes the owner and scopes a bounded searchable list of all team authors in one read snapshot", async () => {
  state.rows = [[org()], []];
  const result = await team.page("org", "actor", {
    page: 2,
    query: "%_",
    status: "draft",
    type: "news",
  });
  expect(result.organization).toEqual({ id: "org", name: "Team", slug: "team" });
  expect(state.transactions).toEqual([
    { isolationLevel: "repeatable read", accessMode: "read only" },
  ]);
  const query = state.queries[1];
  expect(query.params).toEqual(["org", "draft", "news", "%\\%\\_%", "%\\%\\_%", 21, 20]);
  expect(query.sql).toContain('order by "content"."updated_at" desc, "content"."id" desc');
  expect(query.sql.split(" from ")[0]).not.toMatch(/body|email|password/u);
  expect(query.sql).not.toContain('"content"."author_id" =');
});
it.each(["member", "developer", "owner", null])(
  "denies private drafts to non-editors or stale ownership %s before content queries",
  async (role) => {
    state.rows = [[org("actual-owner")], role ? [[role]] : []];
    await expect(team.page("org", "actor")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries).toHaveLength(2);
    expect(writes()).toHaveLength(0);
  },
);
it("lets a current team administrator read another author's draft but never a foreign organization record", async () => {
  state.rows = [[org("actual-owner")], [["admin"]], [publication({ status: "draft" })]];
  expect(await team.get("org", "actor", "content")).toMatchObject({
    content: { authorId: "original", status: "draft" },
  });
  expect(state.queries[2].params).toEqual(["content", "org", 1]);
  state.rows = [[org()], []];
  await expect(team.get("org", "actor", "foreign")).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("uses the shared author mutation, content-first lock order and live team rights without replacing attribution or counters", async () => {
  state.rows = [
    [publication()],
    [org("actual-owner")],
    [["admin"]],
    [publication({ ...fields, status: "draft", updatedAt: later })],
  ];
  const result = await author.mutate(
    "content",
    "actor",
    new Date(time),
    "published",
    fields,
    audit,
    "org",
  );
  expect(result).toMatchObject({ authorId: "original", status: "draft", commentCount: 4 });
  expect(state.queries[0].params).toEqual(["content", "org", 1]);
  expect(state.queries.slice(0, 3).map((q) => q.sql)).toEqual([
    expect.stringContaining("for update"),
    expect.stringContaining("for share"),
    expect.stringContaining("for share"),
  ]);
  const set = writes()[0].sql.split(" set ")[1].split(" where ")[0];
  expect(set).not.toMatch(/author_id|organization_id|server_id|product_id|comment_count|slug/u);
  expect(set).toContain("interval '1 millisecond'");
  expect(writes()[1].params).toContain(
    JSON.stringify({ organizationId: "org", from: "published", to: "draft" }),
  );
});
it.each(["member", "developer", "owner", null])(
  "rechecks revoked organization write rights %s before updates or audit",
  async (role) => {
    state.rows = [[publication()], [org("actual-owner")], role ? [[role]] : []];
    await expect(
      author.mutate("content", "actor", new Date(time), "published", fields, audit, "org"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes()).toHaveLength(0);
  },
);
it.each([
  { status: "archived", code: "CONTENT_ARCHIVED" },
  { updatedAt: later, code: "CONFLICT" },
  { status: "draft", code: "CONFLICT" },
])("protects archive and observed content state %j", async ({ code, ...extra }) => {
  state.rows = [[publication(extra)], [org()]];
  await expect(
    author.mutate("content", "actor", new Date(time), "published", fields, audit, "org"),
  ).rejects.toMatchObject({ code });
  expect(writes()).toHaveLength(0);
});
it("creates in the requested organization and current actor regardless of supplied persistence fields", async () => {
  state.rows = [[org()], [publication({ authorId: "actor", status: "draft" })]];
  await team.create(
    "org",
    "actor",
    {
      ...fields,
      id: "content",
      slug: "new",
      type: "article",
      status: "draft",
      authorId: "victim",
      organizationId: "foreign",
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
    },
    audit,
  );
  expect(state.queries[0].sql).toContain("for update");
  expect(writes()[0].params).toContain("actor");
  expect(writes()[0].params).toContain("org");
  expect(writes()[0].params).not.toContain("victim");
  expect(writes()[0].params).not.toContain("foreign");
  expect(writes()[1].sql).toContain('"audit_events"');
});
it("does not confirm a team edit when audit fails", async () => {
  state.rows = [[publication()], [org()], [publication({ status: "draft", updatedAt: later })]];
  state.failAudit = true;
  await expect(
    author.mutate("content", "actor", new Date(time), "published", fields, audit, "org"),
  ).rejects.toMatchObject({ cause: expect.objectContaining({ message: "audit failure" }) });
});
it("rechecks organization publication rights inside legacy content creation instead of trusting a route precheck", async () => {
  state.rows = [[org("actual-owner")], [["owner"]]];
  await expect(
    contentRepository.createWithAudit(
      {
        ...fields,
        id: "content",
        slug: "new",
        type: "post",
        status: "published",
        authorId: "actor",
        organizationId: "org",
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
      },
      audit,
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(writes()).toHaveLength(0);
});
