import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/initiating-session", async () => {
  const { createCommunityReportGroupsQueryInitiatingSessionMock } = await import(
    "./helpers/community-report-groups-query-harness"
  );
  return createCommunityReportGroupsQueryInitiatingSessionMock();
});

vi.mock("../packages/db/src/repositories/notifications", async () => {
  const { createCommunityReportGroupsQueryNotificationsMock } = await import(
    "./helpers/community-report-groups-query-harness"
  );
  return createCommunityReportGroupsQueryNotificationsMock();
});

vi.mock("../packages/db/src/client", async () => {
  const { createCommunityReportGroupsQueryDbMock } = await import(
    "./helpers/community-report-groups-query-harness"
  );
  return createCommunityReportGroupsQueryDbMock();
});

import { communityReportsRepository as repo } from "../packages/db/src/repositories/community-reports";
import {
  communityReportGroupsQueryBase as base,
  communityReportGroupsQueryContext as context,
  communityReportGroupsQueryCursor as cursor,
  communityReportGroupsQueryGroup as group,
  installCommunityReportGroupsQueryHooks,
  communityReportGroupsQueryStamp as stamp,
  communityReportGroupsQueryState as state,
} from "./helpers/community-report-groups-query-harness";

installCommunityReportGroupsQueryHooks();

it("checks current staff, groups actual reports in SQL and resolves metadata only for the selected page", async () => {
  state.rows = [
    [["moderator"]],
    [[stamp]],
    [group(), group("comment", "comment", "other")],
    [["post", "Publication", "published"]],
    [["comment", "post", "Publication", "Snippet", "archived"]],
  ];
  const result = await repo.groups("staff", base);
  expect(result.items).toHaveLength(2);
  expect(result.items[0]).toMatchObject({
    open: 2,
    review: 1,
    resolved: 3,
    dismissed: 4,
    target: { title: "Publication" },
  });
  expect(result.items[1].target?.text).toBe("Snippet");
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(5);
  const query = state.queries[2];
  expect(query.sql).toContain("group by");
  expect(query.sql).toContain("having count(*) filter");
  expect(query.sql).toContain("in ('content','comment')");
  expect(query.sql).not.toContain("offset");
  expect(query.params).toContain(21);
  expect(query.sql.split(' from "reports"')[0]).not.toMatch(
    /reporter_id|reason|evidence_urls|moderator_notes/u,
  );
  expect(state.queries[3].params).toContain("post");
  expect(state.queries[4].params).toContain("comment");
});
it("does not retrieve metadata for the twenty-first sentinel group", async () => {
  state.rows = [
    [["moderator"]],
    [[stamp]],
    Array.from({ length: 21 }, (_, i) => group("content", `post-${i}`, `anchor-${i}`)),
    [],
  ];
  const result = await repo.groups("staff", base);
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toEqual({ ...cursor, id: "anchor-19" });
  expect(state.queries[3].params).not.toContain("post-20");
});
it("retains literal search, category, target and history filters with the precise window", async () => {
  state.rows = [[["moderator"]], [[stamp]], []];
  await repo.groups("staff", {
    ...base,
    view: "history",
    query: "100%_\\",
    target: "comment",
    type: "spam",
  });
  const query = state.queries[2];
  expect(query.params).toEqual(
    expect.arrayContaining([stamp, 30, "comment", "spam", "%100\\%\\_\\\\%", 21]),
  );
  expect(query.sql).toContain("in ('resolved','dismissed')");
});
it("resolves a cursor's group from scoped stored reports rather than trusting client aggregate times", async () => {
  state.rows = [
    [["moderator"]],
    [["2026-10-12T00:01:00.000000Z"]],
    [["comment", "comment", stamp]],
    [[stamp]],
    [],
  ];
  const result = await repo.groups("staff", { ...base, cursor });
  expect(result.until).toBe(stamp);
  expect(state.queries[2].params).toContain("anchor");
  expect(state.queries[3].sql).toContain("having count(*) filter");
  expect(state.queries[4].sql).toContain(") > (");
  expect(state.queries[4].params).toEqual(expect.arrayContaining([stamp, "comment"]));
});
it.each([
  { cursor: { ...cursor, context: context("other") } },
  { cursor, target: "content" as const },
  { cursor, type: "spam" },
  { cursor, view: "history" as const },
  { before: "legacy" },
])("rejects actor/filter reuse or unsupported anchors before storage %j", async (extra) => {
  await expect(repo.groups("staff", { ...base, ...extra })).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
});
it("rejects deleted anchors or groups with no remaining eligible reports", async () => {
  state.rows = [[["moderator"]], [[stamp]], []];
  await expect(repo.groups("staff", { ...base, cursor })).rejects.toMatchObject({
    code: "REPORT_GROUPS_EXPIRED",
  });
  state.rows = [[["moderator"]], [[stamp]], [["content", "post", stamp]], []];
  await expect(repo.groups("staff", { ...base, cursor })).rejects.toMatchObject({
    code: "REPORT_GROUPS_EXPIRED",
  });
});
it("denies a revoked moderator before aggregate, clock or metadata queries", async () => {
  state.rows = [[["user"]]];
  await expect(repo.groups("staff", base)).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries).toHaveLength(1);
});
it("expires a group whose earliest event changed rather than silently moving the pagination boundary", async () => {
  state.rows = [
    [["moderator"]],
    [[stamp]],
    [["content", "post", stamp]],
    [["2026-10-11T00:00:00.000000Z"]],
  ];
  await expect(repo.groups("staff", { ...base, cursor })).rejects.toMatchObject({
    code: "REPORT_GROUPS_EXPIRED",
  });
  expect(state.queries).toHaveLength(4);
});
