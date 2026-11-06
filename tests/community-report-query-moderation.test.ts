import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/initiating-session", async () => {
  const { createCommunityReportQueryInitiatingSessionMock } = await import(
    "./helpers/community-report-query-harness"
  );
  return createCommunityReportQueryInitiatingSessionMock();
});
vi.mock("../packages/db/src/repositories/discussion-moderation-notice", async () => {
  const { createCommunityReportQueryNoticeMock } = await import(
    "./helpers/community-report-query-harness"
  );
  return createCommunityReportQueryNoticeMock();
});
vi.mock("../packages/db/src/repositories/notifications", async () => {
  const { createCommunityReportQueryNotificationsMock } = await import(
    "./helpers/community-report-query-harness"
  );
  return createCommunityReportQueryNotificationsMock();
});
vi.mock("../packages/db/src/client", async () => {
  const { createCommunityReportQueryDbMock } = await import(
    "./helpers/community-report-query-harness"
  );
  return createCommunityReportQueryDbMock();
});

import { communityReportsRepository as repository } from "../packages/db/src/repositories/community-reports";
import {
  discussionRevision,
  moderationDiscussionRevision,
} from "../packages/db/src/repositories/discussion-management";
import {
  createHash,
  installCommunityReportQueryHooks,
  communityReportQueryRemovalRows as removalRows,
  communityReportQueryState as state,
  communityReportQuerySubmission as submission,
} from "./helpers/community-report-query-harness";

installCommunityReportQueryHooks();

const decision = {
  id: "report",
  actorId: "moderator",
  currentToken: "session",
  expectedStatus: "open" as const,
  action: "remove_comment" as const,
  notes: "Spam",
  expectedRevision: discussionRevision("comment", "Original"),
  auditId: "audit",
  removalAuditId: "removal-audit",
};

it("serializes duplicate submissions and stores their audit and delivery source once", async () => {
  state.rows = [[], [["content", "author"]], [["author"]], [["reporter"]], []];
  expect(await repository.submit(submission)).toEqual({ id: "report", created: true });
  expect(state.queries[0].sql).toContain("pg_advisory_xact_lock");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[1].params).toContain("published");
  expect(state.queries[2].sql).toContain('"comments"."product_id" is null');
  expect(state.queries[3].sql).toContain("for share");
  expect(state.queries[4].params).toEqual(
    expect.arrayContaining(["reporter", "comment", "open", "under_review"]),
  );
  const audits = state.queries.filter((query) =>
    query.sql.startsWith('insert into "audit_events"'),
  );
  const deliveries = state.queries.filter((query) =>
    query.sql.startsWith('insert into "report_notification_deliveries"'),
  );
  expect(audits).toHaveLength(1);
  expect(audits[0].params).toContain("report.created");
  expect(deliveries).toHaveLength(1);
  expect(deliveries[0].params).toEqual(expect.arrayContaining(["report", true]));
  state.queries = [];
  state.rows = [[], [["content", "author"]], [["author"]], [["reporter"]], [["existing-report"]]];
  expect(await repository.submit(submission)).toEqual({ id: "existing-report", created: false });
  expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
});
it("rejects hidden/missing targets and own reports before inserting", async () => {
  state.rows = [[], []];
  await expect(repository.submit(submission)).rejects.toMatchObject({ code: "NOT_FOUND" });
  state.queries = [];
  state.rows = [[], [["content", "author"]], [["reporter"]]];
  await expect(repository.submit(submission)).rejects.toMatchObject({ code: "REPORT_OWN_TARGET" });
  expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
});
it("locks publication/comment/live role/report, removes only the comment and writes both audits", async () => {
  removalRows();
  const result = await repository.decide(decision);
  expect(result).toMatchObject({
    id: "report",
    status: "resolved",
    action: "remove_comment",
    removed: true,
    reporterId: "reporter",
  });
  expect(state.queries[2].sql).toContain("for update");
  expect(state.queries[3].sql).toContain("for update");
  expect(state.queries[4].sql).toContain("for share");
  expect(state.queries[5].sql).toContain("for update");
  expect(state.queries[3].sql).toContain('"comments"."product_id" is null');
  const deletion = state.queries.find((query) => query.sql.startsWith("delete"));
  expect(deletion?.params).toEqual(["comment"]);
  expect(deletion?.sql).not.toContain("parent_id");
  const count = state.queries.find((query) => query.sql.startsWith('update "content"'));
  expect(count?.sql).toContain("greatest(0");
  expect(count?.sql).not.toContain("updated_at");
  const audits = state.queries.filter((query) =>
    query.sql.startsWith('insert into "audit_events"'),
  );
  expect(audits).toHaveLength(2);
  expect(JSON.stringify(audits)).not.toContain("Original");
});
it.each([
  { role: "user", code: "FORBIDDEN" },
  { finalRole: "user", code: "FORBIDDEN" },
  { text: "Edited", code: "COMMENT_CHANGED" },
  { status: "resolved", code: "REPORT_STATE_CHANGED" },
])("rejects live role/revision/state changes without writes %j", async ({ code, ...extra }) => {
  removalRows(extra);
  await expect(repository.decide(decision)).rejects.toMatchObject({ code });
  expect(state.queries.some((query) => /^(insert|update|delete)/u.test(query.sql))).toBe(false);
});
it("takes a report for review only from open and requires audit success", async () => {
  state.rows = [
    [["moderator"]],
    [["comment", "comment"]],
    [["moderator"]],
    [["report", "open", "reporter", "comment", "comment"]],
  ];
  expect(
    await repository.decide({ ...decision, action: "review", expectedRevision: undefined }),
  ).toMatchObject({ status: "under_review", removed: false });
  expect(state.queries.find((query) => query.sql.startsWith('update "reports"'))?.params).toEqual(
    expect.arrayContaining(["under_review", "Spam", null]),
  );
  removalRows();
  state.failAudit = true;
  await expect(repository.decide(decision)).rejects.toThrow(/audit_events|audit failure/u);
});

it("uses the shared archived-discussion removal and transactional author notice, resolving only the reviewed report", async () => {
  removalRows();
  state.rows[2] = [["content", "archived", "article", "post"]];
  await repository.decide({
    ...decision,
    expectedRevision: moderationDiscussionRevision(
      "content",
      "comment",
      createHash("sha256").update("Original").digest("hex"),
    ),
  });
  expect(state.notice).toHaveBeenCalledWith(expect.anything(), {
    auditId: "removal-audit",
    authorId: "author",
    commentId: "comment",
    slug: "article",
    available: false,
  });
  const reports = state.queries.filter((query) => query.sql.startsWith('update "reports"'));
  expect(reports).toHaveLength(1);
  expect(reports[0].params.at(-1)).toBe("report");
  const audit = state.queries.find(
    (query) =>
      query.sql.startsWith('insert into "audit_events"') &&
      query.params.includes("content.comment_removed"),
  );
  expect(audit?.params).toContain(
    JSON.stringify({ contentId: "content", moderator: true, reason: "Spam", reportId: "report" }),
  );
});
it("locks both author and reporter preferences in order before either removal notice can queue push", async () => {
  removalRows();
  state.rows[3][0][2] = "z-author";
  state.rows[5][0][2] = "a-reporter";
  state.notice.mockImplementation(() => {
    const locks = state.queries.filter((query) => query.sql.includes("pg_advisory_xact_lock"));
    expect(locks.map((query) => query.params[0])).toEqual([
      "nexus:notification-preference:v1:a-reporter",
      "nexus:notification-preference:v1:z-author",
    ]);
    expect(state.reportNotice).not.toHaveBeenCalled();
  });
  await repository.decide(decision);
  expect(state.notice).toHaveBeenCalledOnce();
  expect(state.reportNotice).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ recipientId: "a-reporter", category: "security" }),
    true,
  );
});
it("refuses an old token when legacy text was truncated and accepts its complete scoped digest", async () => {
  removalRows();
  state.rows[3][0][4] = true;
  await expect(repository.decide(decision)).rejects.toMatchObject({ code: "COMMENT_CHANGED" });
  expect(state.queries.some((query) => /^(insert|update|delete)/u.test(query.sql))).toBe(false);
  removalRows();
  state.rows[3][0][4] = true;
  await repository.decide({
    ...decision,
    expectedRevision: moderationDiscussionRevision(
      "content",
      "comment",
      createHash("sha256").update("Original").digest("hex"),
    ),
  });
  expect(state.queries[3].sql).toContain("sha256(convert_to(");
  expect(state.notice).toHaveBeenCalledTimes(1);
});
it("requires the shared moderation notice to succeed and denies report-only mutation without a report lock hook", async () => {
  removalRows();
  state.notice.mockRejectedValueOnce(Error("notice failure"));
  await expect(repository.decide(decision)).rejects.toThrow("notice failure");
  expect(state.queries.some((query) => query.sql.startsWith('update "reports"'))).toBe(false);
  const { discussionManagementRepository } = await import(
    "../packages/db/src/repositories/discussion-management"
  );
  state.queries = [];
  await expect(
    discussionManagementRepository.mutate({
      moderationWorkspace: true,
      actorId: "moderator",
      reportId: "report",
      commentId: "comment",
      expectedRevision: decision.expectedRevision,
      reason: "Reason",
      auditId: "audit",
    }),
  ).rejects.toMatchObject({ code: "COMMENT_COMMAND_INVALID" });
  expect(state.queries).toHaveLength(0);
});
