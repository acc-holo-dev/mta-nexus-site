import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: [] as unknown[],
  notice: vi.fn(),
  failAudit: false,
}));
vi.mock("../packages/db/src/repositories/discussion-moderation-notice", () => ({
  discussionModerationNotice: state.notice,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("Audit unavailable");
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
import { discussionWorkspaceRepository as own } from "../packages/db/src/repositories/discussion-workspace";
import {
  discussionManagementRepository as management,
  discussionRevision,
} from "../packages/db/src/repositories/discussion-management";
import { publicVerificationHistoryRepository as approvals } from "../packages/db/src/repositories/public-verification-history";
const time = "2026-10-11T00:00:00.123456Z";
const context = (subject = "subject", type = "") =>
  createHash("sha256")
    .update(JSON.stringify([1, "public-approvals", subject, type]))
    .digest("hex");
const command = (extra = {}) => ({
  contentId: "content",
  ownWorkspace: true,
  commentId: "comment",
  actorId: "author",
  expectedRevision: discussionRevision("comment", "Original"),
  auditId: "audit",
  ...extra,
});
function mutationRows(status = "published", author = "author", role = "user", type = "post") {
  state.rows = [[["content", status, "guide", type]], [["comment", "Original", author]], [[role]]];
}
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.transactions = [];
  state.failAudit = false;
  state.notice.mockReset();
});
it("queries only the actor's publication comments and searches private titles only behind a public gate", async () => {
  await own.page("actor", {
    query: "%_",
    availability: "unavailable",
    cursor: { createdAt: time, id: "last" },
  });
  const query = state.queries[0];
  expect(query.params).toEqual(expect.arrayContaining(["actor", "%\\%\\_%", time, "last", 21]));
  expect(query.sql).toContain('"comments"."author_id" =');
  expect(query.sql).toContain('"comments"."product_id" is null');
  expect(query.sql).toContain('"comments"."content_id" is not null');
  expect(query.sql).toContain('left("comments"."text", 350)');
  expect(query.sql).toMatch(/case when.+then "content"\."title" else null end/u);
  expect(query.sql).toMatch(/or \(\(.+published.+\) and "content"\."title" ilike/u);
  expect(query.sql).toContain("not coalesce(");
  expect(query.sql).toContain("US");
  expect(query.sql).toMatch(/\) < \(/u);
  expect(query.sql).not.toMatch(/offset|parent_id|review_status|email|password/u);
});
it("keeps own pages bounded and preserves the exact last visible timestamp", async () => {
  state.rows = [
    Array.from({ length: 21 }, (_, i) => [
      `comment-${i}`,
      "Preview",
      time,
      time,
      null,
      null,
      null,
      false,
    ]),
  ];
  const page = await own.page("actor", { query: "" });
  expect(page.items).toHaveLength(20);
  expect(page.nextCursor).toEqual({ createdAt: time, id: "comment-19" });
});
it("returns the author's bounded legacy text, masking unavailable parent metadata and retaining full revision", async () => {
  const text = "x".repeat(6000);
  state.rows = [[["comment", "content", text, time, null, null, null, false]]];
  const row = await own.find("actor", "comment");
  expect(row.text).toHaveLength(5000);
  expect(row.editable).toBe(false);
  expect(row.revision).toBe(discussionRevision("comment", text));
  expect(state.queries[0].params).toEqual(["actor", "comment", 1]);
  expect(state.queries[0].sql).toContain('"comments"."product_id" is null');
});
it("does not let an administrator look up a foreign or commercial comment", async () => {
  await expect(own.find("admin", "foreign")).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(own.mutate(command({ actorId: "admin" }))).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.transactions).toHaveLength(0);
});
it.each(["draft", "archived"])(
  "removes an own comment from %s under content-first locks without rewriting metadata or replies",
  async (status) => {
    mutationRows(status);
    const result = await management.mutate(command());
    expect(result).toEqual({ contentId: "content", commentId: "comment", removed: true });
    expect(state.queries.slice(0, 3).map((q) => q.sql)).toEqual([
      expect.stringContaining("for update"),
      expect.stringContaining("for update"),
      expect.stringContaining("for share"),
    ]);
    expect(state.queries[1].params).toContain("author");
    const writes = state.queries.filter((q) => /^(delete|update)/u.test(q.sql));
    expect(writes).toHaveLength(2);
    expect(writes[0].params).toEqual(["comment"]);
    expect(writes[1].sql).toContain("greatest(0,");
    expect(writes[1].sql).not.toMatch(/updated_at|published_at|status|reputation/u);
    expect(state.notice).not.toHaveBeenCalled();
  },
);
it("resolves a scoped pointer then rechecks ownership in the existing locked mutation", async () => {
  mutationRows();
  state.rows.unshift([["content"]]);
  await own.mutate(command({ text: "Edited" }));
  expect(state.queries[0].params).toEqual(["author", "comment", 1]);
  expect(state.queries[2].params).toEqual(["comment", "content", "author", 1]);
  expect(state.queries.filter((q) => q.sql.startsWith("update"))).toHaveLength(1);
});
it.each(["draft", "archived"])("denies own editing in %s before writes", async (status) => {
  mutationRows(status);
  await expect(management.mutate(command({ text: "Edited" }))).rejects.toMatchObject({
    code: "DISCUSSION_UNAVAILABLE",
  });
  expect(state.queries).toHaveLength(3);
});
it("denies unsupported publication types and foreign own-workspace comments even for a live admin", async () => {
  mutationRows("published", "author", "user", "commercial");
  await expect(management.mutate(command({ text: "Edited" }))).rejects.toMatchObject({
    code: "DISCUSSION_UNAVAILABLE",
  });
  mutationRows("published", "other", "admin");
  await expect(management.mutate(command())).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.notice).not.toHaveBeenCalled();
});
it("rejects stale revisions, missing live actors and ambiguous scopes before any write", async () => {
  mutationRows();
  await expect(
    management.mutate(command({ expectedRevision: "a".repeat(64) })),
  ).rejects.toMatchObject({ code: "COMMENT_CHANGED" });
  mutationRows();
  state.rows[2] = [];
  await expect(management.mutate(command())).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(management.mutate(command({ slug: "guide" }))).rejects.toMatchObject({
    code: "COMMENT_COMMAND_INVALID",
  });
  expect(state.queries.some((q) => /^(update|delete|insert)/u.test(q.sql))).toBe(false);
});
it("does not notify a moderator removal when the audit cannot persist", async () => {
  mutationRows("published", "other", "moderator");
  state.failAudit = true;
  await expect(
    management.mutate({
      ...command(),
      ownWorkspace: false,
      contentId: undefined,
      slug: "guide",
      reason: "Spam",
    }),
  ).rejects.toThrow();
  expect(state.notice).not.toHaveBeenCalled();
});
it("reads current flags and only dated public approvals from one read-only repeatable snapshot", async () => {
  state.rows = [
    [["subject", "writer", "Writer", false, true]],
    [["b".repeat(32), "developer", time, time]],
  ];
  const page = await approvals.page("writer", {});
  expect(state.transactions).toEqual([
    { isolationLevel: "repeatable read", accessMode: "read only" },
  ]);
  expect(page.subject).toEqual({
    username: "writer",
    name: "Writer",
    identityVerified: false,
    developerVerified: true,
  });
  expect(page.context).toBe(context());
  const query = state.queries[1];
  expect(query.params).toEqual(["subject", "approved", "user", "developer", 21]);
  expect(query.sql).toContain('"verification_requests"."resolved_at" is not null');
  expect(query.sql).toContain('md5("verification_requests"."id")');
  expect(query.sql).not.toMatch(/requester_id|proof_url|review_notes|reviewer_id|created_at/u);
  expect(JSON.stringify(page.subject)).not.toContain("subject");
});
it.each([context("other"), context("subject", "developer")])(
  "rejects approval cursors bound to another subject or filter",
  async (wrong) => {
    state.rows = [[["subject", "writer", "Writer", false, false]]];
    await expect(
      approvals.page("writer", { cursor: { createdAt: time, id: "a".repeat(32), context: wrong } }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(1);
  },
);
it("paginates approval ties using the public opaque key and exact microseconds", async () => {
  state.rows = [
    [["subject", "writer", "Writer", false, false]],
    Array.from({ length: 21 }, (_, i) => [i.toString(16).padStart(32, "0"), "user", time, time]),
  ];
  const page = await approvals.page("writer", {
    type: "user",
    cursor: { createdAt: time, id: "f".repeat(32), context: context("subject", "user") },
  });
  expect(page.items).toHaveLength(20);
  expect(page.nextCursor).toEqual({ createdAt: time, id: (19).toString(16).padStart(32, "0") });
  expect(state.queries[1].params).toEqual([
    "subject",
    "approved",
    "user",
    time,
    "f".repeat(32),
    21,
  ]);
  expect(state.queries[1].sql).toMatch(/\) < \(/u);
  expect(state.queries[1].sql).not.toContain("offset");
});
it("returns 404 for absent approval subjects before querying requests", async () => {
  await expect(approvals.page("missing", {})).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
});
