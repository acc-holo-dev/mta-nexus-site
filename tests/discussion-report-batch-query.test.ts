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
  discussionReportBatchQueryInput as input,
  discussionReportBatchQueryRows as rows,
  discussionReportBatchQueryState as state,
  discussionReportBatchQueryWrites as writes,
} from "./helpers/discussion-report-batch-query-harness";

installDiscussionReportBatchQueryHooks();

it("previews exact selected report states after live role and content-first locks, without mutation or private fields", async () => {
  rows();
  const preview = await repo.previewDiscussionBatch("staff", "post", "comment", input);
  expect(preview.items.map((item) => [item.id, item.before, item.after])).toEqual([
    ["a", "open", "resolved"],
    ["b", "under_review", "resolved"],
  ]);
  expect(preview.comment).toMatchObject({ text: "Preview", truncated: true });
  expect(JSON.stringify(preview)).not.toMatch(/reporterId|reporter-a|digest|moderatorNotes/u);
  expect(writes()).toHaveLength(0);
  expect(state.queries[0].sql).not.toContain("for share");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain('"comments"."product_id" is null');
  expect(state.queries[3].sql).toContain("for share");
  expect(state.queries[4].sql).toContain('order by "reports"."id" asc');
  expect(state.queries[4].params).toEqual(["comment", "comment", "a", "b"]);
  expect(state.queries[4].sql).not.toContain("offset");
});

it("supports explicit decisions for a proven removed comment, while refusing forged tombstones", async () => {
  rows({ removed: true });
  expect((await repo.previewDiscussionBatch("staff", "post", "comment", input)).comment).toBeNull();
  expect(state.queries[3].params).toEqual(
    expect.arrayContaining(["post", "comment", "content.comment_removed"]),
  );
  state.queries = [];
  rows({ removed: true });
  state.rows[3] = [];
  await expect(
    repo.previewDiscussionBatch("staff", "post", "comment", input),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(4);
});

it.each(
  [
    [],
    [
      { id: "a", expectedStatus: "open" },
      { id: "a", expectedStatus: "open" },
    ],
    Array.from({ length: 21 }, (_, i) => ({ id: `r-${i}`, expectedStatus: "open" })),
    [{ id: "../foreign", expectedStatus: "open" }],
  ].map((items) => ({ items })),
)("bounds selection at storage boundary %j", async ({ items }) => {
  await expect(
    repo.previewDiscussionBatch("staff", "post", "comment", {
      ...input,
      items: items as unknown as typeof input.items,
    }),
  ).rejects.toMatchObject({ code: "REPORT_BATCH_INVALID" });
  expect(state.queries).toHaveLength(0);
});
