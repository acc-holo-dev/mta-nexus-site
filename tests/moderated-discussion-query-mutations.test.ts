import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/discussion-moderation-notice", async () => {
  const { moderatedDiscussionQueryState } = await import(
    "./helpers/moderated-discussion-query-harness"
  );
  return { discussionModerationNotice: moderatedDiscussionQueryState.notice };
});
vi.mock("../packages/db/src/client", async () => {
  const { createModeratedDiscussionQueryDbMock } = await import(
    "./helpers/moderated-discussion-query-harness"
  );
  return createModeratedDiscussionQueryDbMock();
});

import {
  discussionManagementRepository as management,
  moderationDiscussionRevision,
} from "../packages/db/src/repositories/discussion-management";
import {
  installModeratedDiscussionQueryHooks,
  moderatedDiscussionQueryDigest as digest,
  moderatedDiscussionQueryMutationRows as mutationRows,
  moderatedDiscussionQueryState as state,
  moderatedDiscussionQueryWrites as writes,
} from "./helpers/moderated-discussion-query-harness";

installModeratedDiscussionQueryHooks();

const revision = moderationDiscussionRevision("post", "comment", digest);
const command = {
  contentId: "post",
  commentId: "comment",
  actorId: "staff",
  moderationWorkspace: true,
  expectedRevision: revision,
  reason: "Recorded reason",
  auditId: "audit",
};

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
