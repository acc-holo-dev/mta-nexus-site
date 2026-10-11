import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
  notice: vi.fn(),
}));
vi.mock("../packages/db/src/repositories/discussion-moderation-notice", () => ({
  discussionModerationNotice: state.notice,
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

import { communityReportsRepository as repository } from "../packages/db/src/repositories/community-reports";
import {
  discussionRevision,
  moderationDiscussionRevision,
} from "../packages/db/src/repositories/discussion-management";

const time = "2026-10-10T00:00:00Z";
const reportRow = [
  "report",
  "comment",
  "comment",
  "abuse",
  "Report reason",
  [],
  "open",
  time,
  null,
];
const submission = {
  actorId: "reporter",
  id: "report",
  auditId: "audit",
  targetType: "comment" as const,
  targetId: "comment",
  type: "abuse",
  reason: "Report reason",
  evidenceUrls: [],
};
const decision = {
  id: "report",
  actorId: "moderator",
  expectedStatus: "open" as const,
  action: "remove_comment" as const,
  notes: "Spam",
  expectedRevision: discussionRevision("comment", "Original"),
  auditId: "audit",
  removalAuditId: "removal-audit",
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.failAudit = false;
  state.notice.mockReset();
});
function removalRows(
  extra: { role?: string; finalRole?: string; text?: string; status?: string } = {},
) {
  state.rows = [
    [[extra.role ?? "moderator"]],
    [["comment", "comment"]],
    [["content", "published", "article", "post"]],
    [
      [
        "comment",
        extra.text ?? "Original",
        "author",
        createHash("sha256")
          .update(extra.text ?? "Original")
          .digest("hex"),
        false,
      ],
    ],
    [[extra.finalRole ?? "moderator"]],
    [["report", extra.status ?? "open", "reporter", "comment", "comment"]],
  ];
}
it("uses bounded owner-scoped history with stable ordering and excludes existing commercial review comments", async () => {
  await repository.page(
    { actorId: "reporter", staff: false },
    { view: "history", page: 2, target: "comment", type: "spam" },
  );
  expect(state.queries).toHaveLength(1);
  const query = state.queries[0];
  expect(query.params).toEqual(
    expect.arrayContaining(["reporter", "resolved", "dismissed", "comment", "spam", 21, 20]),
  );
  expect(query.sql).toContain('"reports"."reporter_id"');
  expect(query.sql).toContain('"comments"."product_id" is null');
  expect(query.sql).toContain('order by "reports"."created_at" desc, "reports"."id" desc');
  expect(query.sql.split(" from ")[0]).not.toMatch(/moderator_notes|reporter_id|email|password/u);
});
it("rechecks and locks current staff roles before oldest-first queue reads", async () => {
  state.rows = [[["moderator"]]];
  await repository.page({ actorId: "moderator", staff: true }, { view: "pending", page: 1 });
  expect(state.queries[0].sql).toContain("for share");
  expect(state.queries[1].sql).toContain('order by "reports"."created_at" asc, "reports"."id" asc');
  state.queries = [];
  state.rows = [[["user"]]];
  await expect(
    repository.page({ actorId: "revoked", staff: true }, { view: "pending", page: 1 }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.queries).toHaveLength(1);
});
it("limits result rows to twenty and rejects unbounded offsets before querying", async () => {
  state.rows = [
    Array.from({ length: 21 }, (_, index) => [`report-${index}`, ...reportRow.slice(1)]),
  ];
  expect(
    await repository.page({ actorId: "reporter", staff: false }, { view: "pending", page: 1 }),
  ).toMatchObject({ hasMore: true, items: expect.any(Array) });
  state.rows = [Array.from({ length: 21 }, () => reportRow)];
  expect(
    (await repository.page({ actorId: "reporter", staff: false }, { view: "pending", page: 1 }))
      .items,
  ).toHaveLength(20);
  state.queries = [];
  await expect(
    repository.page({ actorId: "reporter", staff: false }, { view: "pending", page: 10000 }),
  ).rejects.toThrow(RangeError);
  expect(state.queries).toHaveLength(0);
});
it("reads owner detail without staff notes and previews only a public noncommercial target", async () => {
  state.rows = [
    [reportRow],
    [
      [
        "comment",
        "article",
        "Title",
        "Original",
        false,
        "published",
        "author",
        "content",
        createHash("sha256").update("Original").digest("hex"),
        "content",
      ],
    ],
  ];
  const result = await repository.detail({ actorId: "reporter", staff: false }, "report");
  expect(result).not.toHaveProperty("moderatorNotes");
  expect(state.queries[0].params).toContain("reporter");
  expect(state.queries[1].params).toContain("published");
  expect(state.queries[1].sql).toContain('"comments"."product_id" is null');
  expect(result.target?.revision).toBe(
    moderationDiscussionRevision(
      "content",
      "comment",
      createHash("sha256").update("Original").digest("hex"),
    ),
  );
});
it("returns not found for another reporter before reading its target", async () => {
  await expect(
    repository.detail({ actorId: "other", staff: false }, "report"),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
});
it("serializes duplicate submissions, gates publication/comment under share locks and audits once", async () => {
  state.rows = [[], [["content", "author"]], [["author"]], []];
  expect(await repository.submit(submission)).toEqual({ id: "report", created: true });
  expect(state.queries[0].sql).toContain("pg_advisory_xact_lock");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[1].params).toContain("published");
  expect(state.queries[2].sql).toContain('"comments"."product_id" is null');
  expect(state.queries[3].params).toEqual(
    expect.arrayContaining(["reporter", "comment", "open", "under_review"]),
  );
  expect(state.queries.at(-1)?.params).toContain("report.created");
  state.queries = [];
  state.rows = [[], [["content", "author"]], [["author"]], [["existing-report"]]];
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
it("recovers a removed report's staff discussion link only from trusted creation context", async () => {
  state.rows = [[["moderator"]], [[...reportRow, "reporter", "Private note"]], [], [["content"]]];
  const detail = await repository.detail({ actorId: "moderator", staff: true }, "report");
  expect(detail.target).toBeNull();
  expect(detail.moderationContentId).toBe("content");
  expect(state.queries[3].params).toEqual(expect.arrayContaining(["report.created", "report"]));
  expect(state.queries[3].sql).toContain("'article','news'");
  state.rows = [[reportRow], []];
  const own = await repository.detail({ actorId: "reporter", staff: false }, "report");
  expect(own).not.toHaveProperty("moderationContentId");
});
