import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { content, users } from "../packages/db/src/schema";
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
        // SQL and serialization coverage; this adapter does not prove PostgreSQL locking or rollback.
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { authorContentRepository } from "../packages/db/src/repositories/author-content";
import { UserRepository } from "../packages/db/src/repositories/users";
const version = new Date("2026-10-10T12:00:00.000Z");
const fixture = {
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
  createdAt: version.toISOString(),
  updatedAt: version.toISOString(),
  publishedAt: version.toISOString(),
  viewCount: 99,
  likeCount: 3,
  commentCount: 10,
};
const row = (overrides: Record<string, unknown> = {}) =>
  Object.keys(getTableColumns(content)).map(
    (key) => ({ ...fixture, ...overrides })[key as keyof typeof fixture] ?? null,
  );
const fields = {
  title: "Edited title",
  body: "A complete edited body.",
  tags: ["lua"],
  excerpt: "",
  coverImageUrl: "",
};
const audit = {
  id: "aud_1",
  actorId: "usr_1",
  actorType: "user" as const,
  action: "content.edited_by_author",
  targetId: "cnt_1",
  targetType: "content",
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
});
it("bounds author lists, retains stable tie ordering, and does not select the body", async () => {
  await authorContentRepository.pageByAuthor("usr_1", {
    page: 2,
    query: "%_",
    status: "draft",
    type: "article",
  });
  const query = state.queries[0];
  expect(query.sql).toContain('"content"."author_id" =');
  expect(query.sql).toContain('order by "content"."updated_at" desc, "content"."id" desc');
  expect(query.sql.split(" from ")[0]).not.toContain('"body"');
  expect(query.params).toEqual(["usr_1", "draft", "article", "%\\%\\_%", "%\\%\\_%", 21, 20]);
});
it("restricts public catalogs to published content and abbreviates body projections", async () => {
  await authorContentRepository.pagePublic(["post", "question"], {
    page: 2,
    status: "draft",
    query: "Lua",
  });
  expect(state.queries[0].sql).toContain('left("body", 350)');
  expect(state.queries[0].params).toContain("published");
  expect(state.queries[0].params).not.toContain("draft");
  expect(state.queries[0].params).toEqual([
    "published",
    "post",
    "question",
    "%Lua%",
    "%Lua%",
    "%Lua%",
    "%Lua%",
    25,
    24,
  ]);
  expect(state.queries[0].sql).toContain(
    'coalesce("content"."published_at", "content"."created_at") desc, "content"."id" desc',
  );
});
it("returns empty without querying an incompatible catalog type", async () => {
  expect(await authorContentRepository.pagePublic(["article"], { type: "question" })).toEqual({
    items: [],
    page: 1,
    hasMore: false,
  });
  expect(state.queries).toHaveLength(0);
});
it("uses a locked author match and returns editorial edits to review without counter changes", async () => {
  state.rows = [
    [row()],
    [
      row({
        ...fields,
        status: "draft",
        publishedAt: null,
        updatedAt: new Date(version.getTime() + 1).toISOString(),
      }),
    ],
    [],
  ];
  expect(
    await authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit),
  ).toMatchObject({ status: "draft", viewCount: 99, likeCount: 3, commentCount: 10 });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[0].params).toEqual(["cnt_1", "usr_1", 1]);
  const set = state.queries[1].sql.split(" set ")[1].split(" where ")[0];
  expect(set).not.toContain('"author_id"');
  expect(set).not.toContain('"slug"');
  expect(set).not.toContain('"comment_count"');
  expect(set).toContain("interval '1 millisecond'");
  expect(state.queries[2].sql).toContain('insert into "audit_events"');
});
it.each(["post", "question"])("keeps published community %s edits visible", async (type) => {
  state.rows = [[row({ type })], [row({ type, status: "published" })], []];
  expect(
    await authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit),
  ).toMatchObject({ status: "published" });
  expect(state.queries[1].params).toContain("published");
});
it("rejects a stale writer version before update or audit", async () => {
  state.rows = [[row()]];
  await expect(
    authorContentRepository.mutate(
      "cnt_1",
      "usr_1",
      new Date(version.getTime() - 1),
      "published",
      fields,
      audit,
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(state.queries).toHaveLength(1);
});
it("rejects a moderation transition even if its timestamp matches the submitted millisecond", async () => {
  state.rows = [[row({ status: "draft" })]];
  await expect(
    authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(state.queries).toHaveLength(1);
});
it("rejects archived content before update or audit", async () => {
  state.rows = [[row({ status: "archived" })]];
  await expect(
    authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit),
  ).rejects.toMatchObject({ code: "CONTENT_ARCHIVED" });
  expect(state.queries).toHaveLength(1);
});
it("does not permit editing another author's record", async () => {
  await expect(
    authorContentRepository.mutate("cnt_1", "usr_other", version, "published", fields, audit),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries[0].params).toContain("usr_other");
  expect(state.queries).toHaveLength(1);
});
it.each(["owner", "admin", "developer"])(
  "rechecks the organization's %s role under shared locks",
  async (role) => {
    state.rows = [
      [row({ organizationId: "org_1" })],
      [["usr_other_owner"]],
      [[role]],
      [row({ status: "draft" })],
      [],
    ];
    await authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit);
    expect(state.queries[1].sql).toContain("for share");
    expect(state.queries[2].sql).toContain("for share");
    expect(state.queries[2].params).toEqual(["org_1", "usr_1", 1]);
  },
);
it.each([null, "member"])(
  "blocks absent or revoked organizational edit rights (%s)",
  async (role) => {
    state.rows = [[row({ organizationId: "org_1" })], [["usr_other_owner"]], role ? [[role]] : []];
    await expect(
      authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries).toHaveLength(3);
  },
);
it("archives through a status update and an audit, preserving replies", async () => {
  state.rows = [[row()], [row({ status: "archived" })], []];
  await authorContentRepository.mutate("cnt_1", "usr_1", version, "published", null, audit);
  expect(state.queries.some((query) => query.sql.includes("delete"))).toBe(false);
  expect(state.queries[1].params).toContain("archived");
  expect(state.queries[2].params).toContain(JSON.stringify({ from: "published", to: "archived" }));
});
it("profile updates compare milliseconds and write only editable public fields with an audit", async () => {
  const fixture = {
    id: "usr_1",
    username: "writer",
    displayName: "Writer",
    email: "private@test",
    role: "user",
    isVerified: false,
    emailVerified: false,
    twoFactorEnabled: false,
    bio: null,
    avatarUrl: null,
    createdAt: version.toISOString(),
    updatedAt: new Date(version.getTime() + 1).toISOString(),
  };
  state.rows = [
    [
      Object.keys(getTableColumns(users))
        .filter((key) => key !== "passwordHash")
        .map((key) => fixture[key as keyof typeof fixture] ?? null),
    ],
    [],
  ];
  expect(
    await new UserRepository().updatePublicProfile(
      "usr_1",
      version,
      { displayName: "Writer", bio: "", avatarUrl: "" },
      "aud_1",
    ),
  ).toMatchObject({ displayName: "Writer" });
  const update = state.queries[0];
  expect(update.sql).toContain("date_trunc('milliseconds'");
  expect(update.sql.split(" returning ")[1]).not.toContain('"password_hash"');
  const set = update.sql.split(" set ")[1].split(" where ")[0];
  expect(set).not.toContain('"role"');
  expect(set).not.toContain('"email"');
  expect(set).not.toContain('"is_verified"');
  expect(state.queries[1].params).toContain("user.profile_updated");
});
it("does not audit an unconfirmed profile update", async () => {
  expect(
    await new UserRepository().updatePublicProfile(
      "usr_1",
      version,
      { displayName: "Writer", bio: "", avatarUrl: "" },
      "aud_1",
    ),
  ).toBeNull();
  expect(state.queries).toHaveLength(1);
});
