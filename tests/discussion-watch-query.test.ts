import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: sql.includes("pg_advisory_xact_lock") ? [] : (state.rows.shift() ?? []) };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { db } from "../packages/db/src/client";
import { followWorkspaceRepository as repository } from "../packages/db/src/repositories/follow-workspace";

const stamp = "2026-10-12T00:00:00.123456Z";
const notice = () =>
  db.transaction((tx) => repository.discussionNoticeWithin(tx, "reader", "article", "reply"));
beforeEach(() => {
  state.queries = [];
  state.rows = [];
});
it("locks only a currently public editorial publication before subscribing with database time", async () => {
  state.rows = [[["article"]], [["follow"]]];
  expect(await repository.setFollowing("reader", "content", "article", true, "follow")).toEqual({
    following: true,
    created: true,
  });
  expect(state.queries[0].params).toEqual([JSON.stringify(["reader", "content", "article"])]);
  expect(state.queries[1].sql).toContain('"content"."product_id" is null');
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[1].params).toEqual(
    expect.arrayContaining(["published", "post", "news", "article", "review"]),
  );
  expect(state.queries[1].params).not.toContain("resource");
  expect(state.queries[2].sql).toContain("clock_timestamp()");
  expect(state.queries[2].sql).toContain("on conflict do nothing");
});
it("confirms repeated subscriptions and denies an inaccessible publication", async () => {
  state.rows = [[["article"]], [], [["existing"]]];
  expect(await repository.setFollowing("reader", "content", "article", true, "follow")).toEqual({
    following: true,
    created: false,
  });
  expect(state.queries.at(-1)?.params).toEqual(["reader", "content", "article", 1]);
  state.rows = [[]];
  await expect(
    repository.setFollowing("reader", "content", "draft", true, "follow"),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("unsubscribes the exact private key without reading a deleted or archived target", async () => {
  await repository.setFollowing("reader", "content", "deleted", false, "unused");
  expect(state.queries).toHaveLength(2);
  expect(state.queries[1].sql).toContain('delete from "follows"');
  expect(state.queries[1].params).toEqual(["reader", "content", "deleted"]);
});
it("scopes saved discussion metadata within the accessible join and bounds latest reply lookups", async () => {
  await repository.page("reader", { type: "content", query: "%_" });
  const query = state.queries[0];
  expect(query.sql).toContain('left join "content"');
  expect(query.sql).toContain('case when "content"."id" is not null then jsonb_build_object');
  expect(query.sql.match(/order by created_at desc,id desc limit 1/gu)).toHaveLength(2);
  expect(query.sql).toContain("'latestAt'");
  expect(query.sql).toContain('"content"."product_id" is null');
  expect(query.params).toEqual(
    expect.arrayContaining(["reader", "content", "published", "%\\%\\_%", 21]),
  );
  expect(query.sql).not.toMatch(/comments\.text|email|password|storage_key/u);
});
it("collects distinct live direct participants and excludes the comment author", async () => {
  state.rows = [[["writer", stamp, "owner", "parent"]], [["owner"]]];
  expect(await repository.discussionAudience("article", "reply")).toEqual({
    authorId: "writer",
    createdAt: stamp,
    directRecipients: ["owner"],
  });
  expect(state.queries[0].sql).toContain('inner join "content"');
  expect(state.queries[1].params).toEqual(["parent", "article", 1]);
  state.rows = [[["owner", stamp, "owner", null]]];
  expect((await repository.discussionAudience("article", "reply"))?.directRecipients).toEqual([]);
});
it("stops before looking up participants if the comment or public publication is gone", async () => {
  expect(await repository.discussionAudience("article", "reply")).toBeNull();
  expect(state.queries).toHaveLength(1);
});
it("walks fifty followers with a sentinel, event watermark and exact ascending timestamp/id cursor", async () => {
  state.rows = [Array.from({ length: 51 }, (_, i) => [`follow_${i}`, `reader_${i}`, stamp])];
  const page = await repository.discussionFollowers(
    "article",
    stamp,
    ["writer", "owner", "parent"],
    { id: "previous", createdAt: stamp },
  );
  expect(page.items).toHaveLength(50);
  expect(page.nextCursor).toEqual({ id: "follow_49", createdAt: stamp });
  const query = state.queries[0];
  expect(query.params).toEqual([
    "content",
    "article",
    stamp,
    "writer",
    "owner",
    "parent",
    stamp,
    "previous",
    51,
  ]);
  expect(query.sql).toContain('"follows"."created_at"<=');
  expect(query.sql).toContain('("follows"."created_at","follows"."id")>');
  expect(query.sql).toContain('order by "follows"."created_at" asc, "follows"."id" asc');
  expect(query.sql).toContain('"follows"."follower_id" <>');
});
it("rechecks the exact current recipient subscription while locking the publication and comment", async () => {
  state.rows = [[["article", "current-slug", "owner"]], [["writer", null, stamp]], [["follow"]]];
  const result = await notice();
  const digest = createHash("sha256")
    .update(JSON.stringify([1, "article", "reply", "reader"]))
    .digest("hex");
  expect(result).toEqual({
    direct: false,
    following: true,
    id: `ntf_reply_${digest}`,
    link: "/articles/current-slug?comment=reply#comment-reply",
  });
  expect(state.queries[0].params).toEqual([JSON.stringify(["reader", "content", "article"])]);
  expect(state.queries.slice(1).every((q) => q.sql.includes("for share"))).toBe(true);
  expect(state.queries[2].params).toEqual(["reply", "article", 1]);
  expect(state.queries[3].params).toEqual(["reader", "content", "article", stamp, 1]);
  expect(JSON.stringify(result)).not.toContain("writer");
});
it("recognizes a current parent participant without requiring a subscription", async () => {
  state.rows = [[["article", "article", "owner"]], [["writer", "parent", stamp]], [["reader"]], []];
  expect(await notice()).toMatchObject({ direct: true, following: false });
  expect(state.queries[3].params).toEqual(["parent", "article", 1]);
});
it.each(["unsubscribed", "late_subscription", "deleted_comment", "hidden_publication", "self"])(
  "suppresses %s delivery before any inbox write",
  async (kind) => {
    if (kind === "hidden_publication") state.rows = [[]];
    else if (kind === "deleted_comment") state.rows = [[["article", "article", "owner"]], []];
    else
      state.rows = [
        [["article", "article", "owner"]],
        [[kind === "self" ? "reader" : "writer", null, stamp]],
        [],
      ];
    expect(await notice()).toBeNull();
    expect(state.queries.every((q) => !q.sql.startsWith("insert"))).toBe(true);
    if (kind === "self") expect(state.queries).toHaveLength(3);
  },
);
it.each(["bad/path", "", "x".repeat(129)])(
  "rejects malformed source IDs %s before storage",
  async (id) => {
    await expect(repository.discussionAudience(id, "reply")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      db.transaction((tx) => repository.discussionNoticeWithin(tx, "reader", "article", id)),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.queries).toHaveLength(0);
  },
);
it.each([
  ["article", "bad", [], undefined],
  ["article", stamp, ["one", "two", "three", "four"], undefined],
  ["article", stamp, [], { id: "invalid/", createdAt: stamp }],
  ["article", stamp, [], { id: "valid", createdAt: "2026-10-12T00:00:00.123Z" }],
] as const)(
  "rejects malformed fanout input without scanning subscriptions",
  async (id, time, excluded, cursor) => {
    await expect(
      repository.discussionFollowers(id, time, [...excluded], cursor),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.queries).toHaveLength(0);
  },
);
