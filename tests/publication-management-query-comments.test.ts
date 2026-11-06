import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/discussion-moderation-notice", async () => {
  const { createPublicationManagementQueryNoticeMock } = await import(
    "./helpers/publication-management-query-harness"
  );
  return createPublicationManagementQueryNoticeMock();
});

vi.mock("../packages/db/src/client", async () => {
  const { createPublicationManagementQueryDbMock } = await import(
    "./helpers/publication-management-query-harness"
  );
  return createPublicationManagementQueryDbMock();
});

import {
  discussionManagementRepository as management,
  discussionRevision,
} from "../packages/db/src/repositories/discussion-management";
import {
  installPublicationManagementQueryHooks,
  publicationManagementQueryRows as rows,
  publicationManagementQueryState as state,
} from "./helpers/publication-management-query-harness";

installPublicationManagementQueryHooks();

const command = (extra = {}) => ({
  slug: "article",
  commentId: "comment",
  actorId: "author",
  expectedRevision: discussionRevision("comment", "Original"),
  auditId: "audit",
  ...extra,
});

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
  expect(state.notice).toHaveBeenCalledWith(expect.anything(), {
    auditId: "audit",
    authorId: "other",
    commentId: "comment",
    slug: "article",
    available: true,
  });
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
