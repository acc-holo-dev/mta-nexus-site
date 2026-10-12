import { expect, it } from "vitest";
import {
  communityReportPageQuery,
  parseCommunityReportQuery,
} from "../apps/web/src/lib/community-report-contract";
import {
  parseReportHistoryQuery,
  reportHistoryPageSchema,
} from "../apps/web/src/lib/community-report-history-contract";
import { encodeChangeHistoryCursor } from "../apps/web/src/lib/private-change-history-query";

it("accepts canonical exact-time filtered cursors and rejects ambiguous history queries", () => {
  const cursor = {
    version: 1 as const,
    context: "a".repeat(64),
    until: "2026-10-12T00:00:00.123456Z",
    id: "audit",
  };
  expect(
    parseReportHistoryQuery(
      new URLSearchParams({
        period: "30",
        group: "decision",
        cursor: encodeChangeHistoryCursor(cursor),
      }),
    ),
  ).toMatchObject({ period: "30", group: "decision", cursor });
  for (const query of [
    "group=unknown",
    "q=text",
    "period=all&period=7",
    "group=all&group=review",
    "cursor=",
    "until=2026-10-12T00:00:00.123Z",
    "until=0000-01-01T00:00:00.000000Z",
  ])
    expect(parseReportHistoryQuery(new URLSearchParams(query))).toBeNull();
});
it("bounds literal queue queries and preserves identical SSR/API semantics", () => {
  const expected = { view: "pending", page: 2, target: undefined, type: undefined, query: "100%_" };
  expect(parseCommunityReportQuery(new URLSearchParams("q=%20100%25_%20&page=2"))).toEqual(
    expected,
  );
  expect(communityReportPageQuery({ q: " 100%_ ", page: "2" })).toEqual(expected);
  for (const query of [
    new URLSearchParams({ q: " ".repeat(81) }),
    new URLSearchParams("q=x&q=y"),
    new URLSearchParams("actorId=victim"),
  ])
    expect(parseCommunityReportQuery(query)).toBeNull();
  expect(communityReportPageQuery({ q: ["x", "y"] })).toBeNull();
  expect(communityReportPageQuery({ q: "" })).toMatchObject({ view: "pending", page: 1 });
});
it("rejects staff fields in a requester receipt and mismatched pagination evidence", () => {
  const page = {
    report: { id: "report", type: "abuse", targetType: "comment", status: "open" },
    audience: "requester",
    period: "all",
    group: "all",
    until: "2026-10-12T00:00:00.000000Z",
    items: [],
    hasMore: false,
    nextCursor: null,
  };
  expect(reportHistoryPageSchema.safeParse(page).success).toBe(true);
  expect(reportHistoryPageSchema.safeParse({ ...page, hasMore: true }).success).toBe(false);
  expect(
    reportHistoryPageSchema.safeParse({
      ...page,
      items: [
        {
          id: "audit",
          action: "report.created",
          createdAt: page.until,
          from: null,
          to: "open",
          by: "requester",
          removed: false,
          notes: "secret",
        },
      ],
    }).success,
  ).toBe(false);
});
