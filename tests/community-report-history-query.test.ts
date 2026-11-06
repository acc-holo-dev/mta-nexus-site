import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createCommunityReportHistoryQueryDbMock } = await import(
    "./helpers/community-report-history-query-harness"
  );
  return createCommunityReportHistoryQueryDbMock();
});

import { communityReportsRepository as reports } from "../packages/db/src/repositories/community-reports";
import {
  communityReportHistoryQueryBase as base,
  communityReportHistoryQueryCursor as cursor,
  communityReportHistoryQueryEvent as event,
  communityReportHistoryQueryOwn as own,
  communityReportHistoryQueryReport as report,
  communityReportHistoryQueryStaff as staff,
  communityReportHistoryQueryStamp as stamp,
  communityReportHistoryQueryState as state,
  installCommunityReportHistoryQueryHooks,
} from "./helpers/community-report-history-query-harness";

installCommunityReportHistoryQueryHooks();

it("reads only the requester's report and never selects staff notes, raw details or unrelated actions", async () => {
  state.rows = [[report], [[stamp]], [event()]];
  const result = await reports.history(own, "report", base);
  expect(result).toMatchObject({
    report: { id: "report", type: "abuse", targetType: "comment", status: "under_review" },
    audience: "requester",
    hasMore: false,
    nextCursor: null,
  });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries[0].params).toEqual(["report", "owner", 1]);
  expect(state.queries[0].sql).toContain('"product_id" is null');
  expect(state.queries[2].params).toEqual(
    expect.arrayContaining([
      "report",
      "report.created",
      "report.review",
      "report.resolve",
      "report.dismiss",
      "report.remove_comment",
      stamp,
      21,
    ]),
  );
  expect(state.queries[2].sql).not.toMatch(
    /->'notes'|batchSize|ip_address|user_agent|offset|count\(/u,
  );
  expect(state.queries[2].sql).toContain("jsonb_typeof(");
  expect(JSON.stringify(result)).not.toMatch(/owner|private-comment|reporterId|notes|actorId/u);
});
it("keeps requester privacy when the same account has a moderator role but chooses its own view", async () => {
  state.rows = [[report], [[stamp]], [event()]];
  const result = await reports.history(own, "report", base);
  expect(result.items[0]).not.toHaveProperty("notes");
  expect(state.queries).toHaveLength(3);
});
it("rejects other requesters before clock or audit reads", async () => {
  state.rows = [[]];
  await expect(reports.history(own, "report", base)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(1);
});
it.each([{ rows: [] as unknown[][] }, { rows: [["user"]] }])(
  "rechecks deleted or revoked staff before reading reports: %j",
  async ({ rows }) => {
    state.rows = [rows];
    await expect(reports.history(staff, "report", base)).rejects.toMatchObject({ statusCode: 403 });
    expect(state.queries).toHaveLength(1);
  },
);
it("allows current staff and bounds notes without splitting a UTF-16 pair", async () => {
  state.rows = [
    [["moderator"]],
    [report],
    [[stamp]],
    [[...event(), `${"x".repeat(1999)}😀secret`, 20]],
  ];
  const result = await reports.history(staff, "report", base);
  expect(result.items[0]).toMatchObject({ notes: "x".repeat(1999), batchSize: 20 });
  expect(state.queries[3].sql).toContain("jsonb_typeof(");
  expect(state.queries[3].sql).toContain("left(");
  expect(state.queries[3].sql).toContain("::integer");
  expect(state.queries.some((query) => query.sql.includes("for share"))).toBe(false);
});
it.each([
  ["submission", ["report.created"]],
  ["review", ["report.review"]],
  ["decision", ["report.resolve", "report.dismiss", "report.remove_comment"]],
] as const)("filters %s actions before the seven-day snapshot", async (group, actions) => {
  state.rows = [[report], [[stamp]], []];
  await reports.history(own, "report", { ...base, period: "7", group });
  const query = state.queries[2];
  for (const action of actions) expect(query.params).toContain(action);
  expect(query.params).toContain(7);
  expect(query.sql).toContain("interval '1 day'");
});
it("returns twenty tied events and a context-bound precise cursor", async () => {
  state.rows = [[report], [[stamp]], Array.from({ length: 21 }, (_, i) => event(`event-${i}`))];
  const result = await reports.history(own, "report", base);
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toEqual({ ...cursor, id: "event-19" });
  expect(result.hasMore).toBe(true);
});
