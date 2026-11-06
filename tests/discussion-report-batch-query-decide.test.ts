import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/initiating-session", () => ({
  lockInitiatingSession: vi.fn(),
}));
vi.mock("../packages/db/src/repositories/discussion-moderation-notice", async () => {
  const { discussionReportBatchQueryState } = await import(
    "./helpers/discussion-report-batch-query-harness"
  );
  return { discussionModerationNotice: discussionReportBatchQueryState.notice };
});
vi.mock("../packages/db/src/repositories/notifications", async () => {
  const { discussionReportBatchQueryState } = await import(
    "./helpers/discussion-report-batch-query-harness"
  );
  return {
    notificationRepository: {
      createWithPushOutboxWithin: discussionReportBatchQueryState.reportNotice,
    },
  };
});
vi.mock("../packages/db/src/client", async () => {
  const { createDiscussionReportBatchQueryDbMock } = await import(
    "./helpers/discussion-report-batch-query-harness"
  );
  return createDiscussionReportBatchQueryDbMock();
});

import { communityReportsRepository as repo } from "../packages/db/src/repositories/community-reports";
import {
  installDiscussionReportBatchQueryHooks,
  discussionReportBatchQueryDigest as digest,
  discussionReportBatchQueryInput as input,
  discussionReportBatchQueryRows as rows,
  discussionReportBatchQueryState as state,
  discussionReportBatchQueryWrites as writes,
} from "./helpers/discussion-report-batch-query-harness";

installDiscussionReportBatchQueryHooks();

it("changes all and only reviewed identities in one update and one mandatory audit insertion", async () => {
  rows();
  const preview = await repo.previewDiscussionBatch("staff", "post", "comment", input);
  state.queries = [];
  rows();
  state.rows.push([
    ["b", "resolved"],
    ["a", "resolved"],
  ]);
  const result = await repo.decideDiscussionBatch(
    "staff",
    "post",
    "comment",
    { ...input, previewRevision: preview.previewRevision },
    ["audit-a", "audit-b"],
    "session",
  );
  expect(result).toMatchObject({
    contentId: "post",
    commentId: "comment",
    action: "resolve",
    items: [
      { id: "a", status: "resolved", reporterId: "reporter-a" },
      { id: "b", status: "resolved" },
    ],
  });
  expect(writes()).toHaveLength(2);
  expect(state.queries[4].sql).toContain("for update");
  const update = writes()[0];
  expect(update.sql).toContain('"reports"."target_id"');
  expect(update.params.slice(-4)).toEqual(["comment", "comment", "a", "b"]);
  expect(writes()[1].params).toContain("report.resolve");
  expect(writes()[1].params).toContain(
    JSON.stringify({
      notes: input.notes,
      previousStatus: "open",
      status: "resolved",
      removedCommentId: null,
      contentId: "post",
      commentId: "comment",
      previewRevision: preview.previewRevision,
      batchSize: 2,
    }),
  );
  expect(
    state.queries.some(
      (query) => query.sql.startsWith("delete") || query.sql.startsWith('update "content"'),
    ),
  ).toBe(false);
});

it("locks the entire reporter audience before the first queue admission, independently of report order", async () => {
  const inverseAudience = () => {
    rows();
    state.rows[4][0][6] = "z-reporter";
    state.rows[4][1][6] = "a-reporter";
  };
  inverseAudience();
  const preview = await repo.previewDiscussionBatch("staff", "post", "comment", input);
  state.queries = [];
  inverseAudience();
  state.rows.push([
    ["a", "resolved"],
    ["b", "resolved"],
  ]);
  state.reportNotice.mockImplementation(async () => {
    const locks = state.queries.filter((query) => query.sql.includes("pg_advisory_xact_lock"));
    expect(locks.map((query) => query.params[0])).toEqual([
      "nexus:notification-preference:v1:a-reporter",
      "nexus:notification-preference:v1:z-reporter",
    ]);
    return { notification: null };
  });
  await repo.decideDiscussionBatch(
    "staff",
    "post",
    "comment",
    { ...input, previewRevision: preview.previewRevision },
    ["audit-a", "audit-b"],
    "session",
  );
  expect(state.reportNotice).toHaveBeenCalledTimes(2);
});

it.each(["actor", "publication", "comment", "notes", "action", "text", "report"])(
  "rejects changed reviewed context (%s) before any write",
  async (changed) => {
    rows();
    const preview = await repo.previewDiscussionBatch("staff", "post", "comment", input);
    state.queries = [];
    rows({
      textDigest: changed === "text" ? "c".repeat(64) : digest,
      reportDigest: changed === "report" ? "d".repeat(64) : "a".repeat(64),
    });
    await expect(
      repo.decideDiscussionBatch(
        changed === "actor" ? "foreign" : "staff",
        changed === "publication" ? "foreign" : "post",
        changed === "comment" ? "foreign" : "comment",
        {
          ...input,
          notes: changed === "notes" ? "Changed reason" : input.notes,
          action: changed === "action" ? "dismiss" : "resolve",
          previewRevision: preview.previewRevision,
        },
        ["audit-a", "audit-b"],
        "session",
      ),
    ).rejects.toMatchObject({ code: "REPORT_BATCH_CHANGED" });
    expect(writes()).toHaveLength(0);
  },
);

it.each([
  { role: "user", code: "FORBIDDEN" },
  { finalRole: "user", code: "FORBIDDEN" },
  { status: "resolved", code: "REPORT_STATE_CHANGED" },
  { missing: true, code: "NOT_FOUND" },
])("blocks revoked or stale selected cases %j", async ({ code, ...options }) => {
  rows(options);
  await expect(
    repo.decideDiscussionBatch(
      "staff",
      "post",
      "comment",
      { ...input, previewRevision: "a".repeat(64) },
      ["audit-a", "audit-b"],
      "session",
    ),
  ).rejects.toMatchObject({ code });
  expect(writes()).toHaveLength(0);
});

it("propagates mandatory batch audit failure and rejects unexpected stored states", async () => {
  rows();
  const preview = await repo.previewDiscussionBatch("staff", "post", "comment", input);
  rows();
  state.rows.push([
    ["a", "resolved"],
    ["b", "resolved"],
  ]);
  state.failAudit = true;
  await expect(
    repo.decideDiscussionBatch(
      "staff",
      "post",
      "comment",
      { ...input, previewRevision: preview.previewRevision },
      ["audit-a", "audit-b"],
      "session",
    ),
  ).rejects.toThrow(/audit failure|audit_events/u);
  state.failAudit = false;
  rows();
  state.rows.push([
    ["a", "dismissed"],
    ["b", "resolved"],
  ]);
  await expect(
    repo.decideDiscussionBatch(
      "staff",
      "post",
      "comment",
      { ...input, previewRevision: preview.previewRevision },
      ["audit-a", "audit-b"],
      "session",
    ),
  ).rejects.toMatchObject({ code: "REPORT_STATE_CHANGED" });
});
