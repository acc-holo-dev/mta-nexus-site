import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failure");
    return { rows: state.rows.shift() ?? [] };
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
import { publicationFeedRepository as feed } from "../packages/db/src/repositories/publication-feed";
import {
  discussionManagementRepository as management,
  discussionRevision,
} from "../packages/db/src/repositories/discussion-management";
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.failAudit = false;
});
it.each(["user", "organization", "server", "product"] as const)(
  "scopes feed to actor and selected %s subscriptions in one bounded query",
  async (source) => {
    await feed.page(
      { kind: "following", actorId: "actor" },
      {
        source,
        type: "question",
        query: "%_",
        cursor: { createdAt: "2026-10-10T12:00:00.123456Z", id: "last" },
      },
    );
    expect(state.queries).toHaveLength(1);
    const query = state.queries[0];
    expect(query.params).toEqual(
      expect.arrayContaining([
        "actor",
        source,
        "question",
        "%\\%\\_%",
        "2026-10-10T12:00:00.123456Z",
        "last",
        21,
      ]),
    );
    expect(query.sql).toMatch(/order by coalesce.+ desc, "content"\."id" desc limit/u);
    expect(query.sql).toContain('"follows"."follower_id"');
    expect(query.sql).not.toContain("offset");
    expect(query.sql).toContain("US");
    expect(query.sql.split(" from ")[0]).not.toMatch(/email|password|two_factor|owner_id/u);
  },
);
it("gates server and resource affiliations before returning their metadata", async () => {
  await feed.page({ kind: "user", id: "author" });
  const query = state.queries[0];
  expect(query.sql).toContain('left join "servers"');
  expect(query.params).toEqual(
    expect.arrayContaining(["public", "active", "published", 0, "clean", "author", 21]),
  );
  expect(query.sql).toContain('"builds"."scanner"');
  expect(query.sql).not.toContain('"follows"');
});
it("returns only twenty summaries and builds continuation from exact database time", async () => {
  const time = "2026-10-10T12:00:00.123456Z";
  state.rows = [
    Array.from({ length: 21 }, (_, index) => [
      `content-${index}`,
      "slug",
      "Title",
      "article",
      "Excerpt",
      null,
      0,
      time,
      time,
      "author",
      "writer",
      "Writer",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]),
  ];
  const page = await feed.page({ kind: "user", id: "author" });
  expect(page.items).toHaveLength(20);
  expect(page.hasMore).toBe(true);
  expect(page.nextCursor).toEqual({ createdAt: time, id: "content-19" });
  expect(page.items[0].publishedAt.toISOString()).toBe("2026-10-10T12:00:00.123Z");
});
it.each(["user", "organization"] as const)(
  "uses narrow public identity lookup for %s",
  async (kind) => {
    await feed.resolvePublicScope(kind, "handle");
    expect(state.queries[0].params).toEqual(["handle", 1]);
    expect(state.queries[0].sql.split(" from ")[0]).not.toMatch(/email|owner_id|role|password/u);
  },
);
const command = (extra = {}) => ({
  slug: "article",
  commentId: "comment",
  actorId: "author",
  expectedRevision: discussionRevision("comment", "Original"),
  auditId: "audit",
  ...extra,
});
function rows(author = "author", role = "user") {
  state.rows = [[["content", "published"]], [["comment", "Original", author]], [[role]]];
}
it("locks the publication, comment and live actor, then edits with audit without changing publication revision/count", async () => {
  rows();
  const result = await management.mutate(command({ text: "Edited" }));
  expect(result).toEqual({
    contentId: "content",
    commentId: "comment",
    text: "Edited",
    revision: discussionRevision("comment", "Edited"),
  });
  expect(state.queries.slice(0, 3).map((query) => query.sql)).toEqual([
    expect.stringContaining("for update"),
    expect.stringContaining("for update"),
    expect.stringContaining("for share"),
  ]);
  expect(state.queries[1].sql).toContain('"comments"."product_id" is null');
  expect(state.queries.filter((query) => query.sql.startsWith("update"))).toHaveLength(1);
  expect(state.queries.at(-1)?.params).toContain("content.comment_edited");
});
it.each(["user", "developer"])(
  "prevents a %s from editing/removing another author's comment",
  async (role) => {
    rows("other", role);
    await expect(management.mutate(command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries).toHaveLength(3);
  },
);
it("allows a live moderator to remove another comment with a reason and a guarded counter", async () => {
  rows("other", "moderator");
  expect(await management.mutate(command({ reason: "Spam" }))).toEqual({
    contentId: "content",
    commentId: "comment",
    removed: true,
  });
  expect(state.queries.filter((query) => query.sql.startsWith("delete"))).toHaveLength(1);
  expect(state.queries[4].sql).toContain("greatest(0,");
  expect(state.queries[4].sql).not.toContain("updated_at");
  expect(state.queries.at(-1)?.params).toContain("content.comment_removed");
  expect(JSON.stringify(state.queries.at(-1)?.params)).toContain("Spam");
  expect(JSON.stringify(state.queries.at(-1)?.params)).not.toContain("Original");
});
it("denies moderator edits and removal without reason", async () => {
  rows("other", "moderator");
  await expect(management.mutate(command({ text: "Edit" }))).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  rows("other", "admin");
  await expect(management.mutate(command())).rejects.toMatchObject({
    code: "COMMENT_REASON_REQUIRED",
  });
});
it("rejects stale versions before any write", async () => {
  rows();
  await expect(
    management.mutate(command({ expectedRevision: "a".repeat(64), text: "Edit" })),
  ).rejects.toMatchObject({ code: "COMMENT_CHANGED" });
  expect(state.queries).toHaveLength(3);
});
it("does not mutate archived content, missing comments or product reviews", async () => {
  state.rows = [[["content", "archived"]]];
  await expect(management.mutate(command())).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
  state.queries = [];
  state.rows = [[["content", "published"]], []];
  await expect(management.mutate(command())).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(2);
});
it("surfaces audit failure rather than confirming incomplete persistence", async () => {
  rows();
  state.failAudit = true;
  await expect(management.mutate(command({ text: "Edit" }))).rejects.toThrow();
});
