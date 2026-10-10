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
import { communityReportsRepository as repository } from "../packages/db/src/repositories/community-reports";
import { discussionRevision } from "../packages/db/src/repositories/discussion-management";
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
});
function removalRows(
  extra: { role?: string; finalRole?: string; text?: string; status?: string } = {},
) {
  state.rows = [
    [[extra.role ?? "moderator"]],
    [["comment", "comment"]],
    [["content"]],
    [["comment", extra.text ?? "Original"]],
    [[extra.finalRole ?? "moderator"]],
    [["report", extra.status ?? "open", "reporter", "comment"]],
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
    [["comment", "article", "Title", "Original", false, "published", "author"]],
  ];
  const result = await repository.detail({ actorId: "reporter", staff: false }, "report");
  expect(result).not.toHaveProperty("moderatorNotes");
  expect(state.queries[0].params).toContain("reporter");
  expect(state.queries[1].params).toContain("published");
  expect(state.queries[1].sql).toContain('"comments"."product_id" is null');
  expect(result.target?.revision).toBe(discussionRevision("comment", "Original"));
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
    [["report", "open", "reporter", "comment"]],
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
