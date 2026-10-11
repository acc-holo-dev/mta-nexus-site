import { createHash } from "node:crypto";
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

import { communityModerationWorkspaceRepository as repository } from "../packages/db/src/repositories/community-moderation-workspace";
import {
  discussionManagementRepository as management,
  moderationDiscussionRevision,
} from "../packages/db/src/repositories/discussion-management";

const time = "2026-10-11T00:00:00.123456Z",
  publication = ["post", "Private publication", "guide", "post", "archived"];
const digest = createHash("sha256").update("Complete text 🧑‍💻").digest("hex"),
  revision = moderationDiscussionRevision("post", "comment", digest);
const command = {
  contentId: "post",
  commentId: "comment",
  actorId: "staff",
  moderationWorkspace: true,
  expectedRevision: revision,
  reason: "Recorded reason",
  auditId: "audit",
};
const writes = () => state.queries.filter((query) => /^(insert|update|delete)/u.test(query.sql));
const mutationRows = (role = "moderator", status = "archived", type = "post") => {
  state.rows = [
    [["post", status, "guide", type]],
    [["comment", "Bounded text", "author", digest]],
    [[role]],
  ];
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.config = null;
  state.notice.mockReset();
});
it("checks current staff before private reads, rejects revoked authority and unavailable scope", async () => {
  state.rows = [[["user"]]];
  await expect(repository.discussion("staff", "post", { query: "" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.queries).toHaveLength(1);
  state.rows = [[["moderator"]], []];
  await expect(repository.discussion("staff", "product", { query: "" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("bounds private discussion search and preserves exact microseconds without commercial comments or private accounts", async () => {
  state.rows = [
    [["moderator"]],
    [publication],
    Array.from({ length: 21 }, (_, i) => [
      `comment-${i}`,
      "Preview",
      time,
      time,
      "author",
      "Writer",
    ]),
  ];
  const result = await repository.discussion("staff", "post", { query: "%_", author: "Author" });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toEqual({ createdAt: time, id: "comment-19" });
  const query = state.queries[2];
  expect(query.params).toEqual(expect.arrayContaining(["post", "%\\%\\_%", "author", 21]));
  expect(query.sql).toContain('"comments"."product_id" is null');
  expect(query.sql).toContain('left("comments"."text",350)');
  expect(query.sql).not.toMatch(/offset|email|permissions|password|ip_address/u);
  if (!result.nextCursor) throw new Error("Expected continuation");
  state.rows = [[["moderator"]], [publication]];
  state.queries = [];
  await expect(
    repository.discussion("other-staff", "post", {
      query: "%_",
      author: "Author",
      cursor: { ...result.nextCursor, context: result.context },
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(2);
});
it("reviews bounded text using a complete-text digest and scopes parent context and event history", async () => {
  state.rows = [
    [["moderator"]],
    [publication],
    [["comment", "Preview", true, digest, time, "author", "Writer", "Parent preview"]],
    [["audit", "content.comment_edited", time, time, false, null]],
  ];
  const result = await repository.discussionDetail("staff", "post", "comment");
  expect(result.comment).toMatchObject({ text: "Preview", truncated: true, revision });
  const textQuery = state.queries[2];
  expect(textQuery.sql).toContain("sha256(convert_to(");
  expect(textQuery.sql).toContain("parent.content_id =");
  expect(textQuery.sql).toContain("parent.product_id is null");
  expect(textQuery.sql).toContain('left("comments"."text",5000)');
  const history = state.queries[3];
  expect(history.params).toEqual(
    expect.arrayContaining(["comment", "post", "content.comment_removed", 21]),
  );
  expect(history.sql).not.toMatch(/actor_id|ip_address|user_agent/u);
  expect(JSON.stringify(result)).not.toMatch(/email|password/u);
});
it("allows a removed tombstone only when a retained scoped removal proves its publication", async () => {
  state.rows = [
    [["admin"]],
    [publication],
    [],
    [["removal"]],
    [["removal", "content.comment_removed", time, time, true, "Reason"]],
  ];
  const result = await repository.discussionDetail("staff", "post", "removed");
  expect(result.comment).toBeNull();
  expect(result.history[0].reason).toBe("Reason");
  expect(state.queries[3].params).toEqual(
    expect.arrayContaining(["removed", "post", "content.comment_removed"]),
  );
  state.rows = [[["admin"]], [publication], [], []];
  await expect(repository.discussionDetail("staff", "post", "foreign")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("removes archived discussion with current staff locks and records a reason without deleting replies", async () => {
  mutationRows();
  await expect(management.mutate(command)).resolves.toEqual({
    contentId: "post",
    commentId: "comment",
    removed: true,
  });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("for update");
  expect(state.queries[2].sql).toContain("for share");
  expect(writes().filter((query) => query.sql.startsWith("delete"))).toHaveLength(1);
  expect(writes()[0].params).toEqual(["comment"]);
  expect(writes().find((query) => query.sql.startsWith('update "content"'))?.sql).toContain(
    "greatest(0,",
  );
  const audit = writes().find((query) => query.sql.startsWith("insert"));
  expect(audit?.params).toContain(
    JSON.stringify({ contentId: "post", moderator: true, reason: "Recorded reason" }),
  );
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ available: false, authorId: "author" }),
  );
});
it.each([
  { actor: "user", extra: {}, code: "FORBIDDEN" },
  { actor: "moderator", extra: { text: "Replacement" }, code: "FORBIDDEN" },
  { actor: "admin", extra: { reason: " " }, code: "COMMENT_REASON_REQUIRED" },
  { actor: "admin", extra: { expectedRevision: "f".repeat(64) }, code: "COMMENT_CHANGED" },
])("rejects invalid moderation command $code before writes", async ({ actor, extra, code }) => {
  mutationRows(actor);
  await expect(management.mutate({ ...command, ...extra })).rejects.toMatchObject({ code });
  expect(writes()).toEqual([]);
  expect(state.notice).not.toHaveBeenCalled();
});
it("rejects commercial scope and mixed author/staff scopes before mutation", async () => {
  mutationRows("admin", "published", "resource");
  await expect(management.mutate(command)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
  state.queries = [];
  await expect(management.mutate({ ...command, ownWorkspace: true })).rejects.toMatchObject({
    code: "COMMENT_COMMAND_INVALID",
  });
  expect(state.queries).toEqual([]);
});
