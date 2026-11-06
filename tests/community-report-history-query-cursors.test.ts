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
  communityReportHistoryQueryContext as context,
  communityReportHistoryQueryCursor as cursor,
  communityReportHistoryQueryOwn as own,
  communityReportHistoryQueryReport as report,
  communityReportHistoryQueryStaff as staff,
  communityReportHistoryQueryStamp as stamp,
  communityReportHistoryQueryState as state,
  installCommunityReportHistoryQueryHooks,
} from "./helpers/community-report-history-query-harness";

installCommunityReportHistoryQueryHooks();

it("resolves a cursor within the same report, allowed actions and retained cutoff", async () => {
  state.rows = [[report], [["2026-10-12T00:01:00.000000Z"]], [["anchor", stamp]], []];
  expect((await reports.history(own, "report", { ...base, cursor })).until).toBe(stamp);
  expect(state.queries[2].params).toEqual(expect.arrayContaining(["report", stamp, "anchor", 1]));
  expect(state.queries[3].params).toEqual(expect.arrayContaining([stamp, "anchor", 21]));
  expect(state.queries[3].sql).toContain(") < (");
});
it.each([
  { cursor: { ...cursor, context: context("other") } },
  { cursor, group: "decision" as const },
  { query: "private query" },
  { before: "legacy-id" },
])("rejects a reused scope or unsupported filters before storage %j", async (change) => {
  await expect(reports.history(own, "report", { ...base, ...change })).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
});
it("rejects requester/staff cursor reuse and removed scoped anchors", async () => {
  await expect(reports.history(staff, "report", { ...base, cursor })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  state.rows = [[report], [[stamp]], []];
  await expect(reports.history(own, "report", { ...base, cursor })).rejects.toMatchObject({
    code: "REPORT_HISTORY_EXPIRED",
  });
});
it("adds literal text/ID search after requester scope and preserves oldest-first staff ordering", async () => {
  state.rows = [[]];
  await reports.page(own, { page: 2, view: "pending", query: "100%_\\" });
  expect(state.queries[0].params).toEqual(
    expect.arrayContaining(["owner", "%100\\%\\_\\\\%", 21, 20]),
  );
  expect(state.queries[0].sql).toContain(" ilike ");
  expect(state.queries[0].sql).toContain('"created_at" desc');
  state.rows = [[["moderator"]], []];
  await reports.page(staff, { page: 1, view: "pending", query: "report" });
  expect(state.queries.at(-1)?.sql).toContain('"created_at" asc');
});
it.each(["x".repeat(81), " padded "])(
  "rejects invalid repository search before storage %s",
  async (query) => {
    await expect(reports.page(own, { page: 1, view: "pending", query })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(state.queries).toHaveLength(0);
  },
);
