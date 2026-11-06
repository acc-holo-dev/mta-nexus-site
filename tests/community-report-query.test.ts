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
import { moderationDiscussionRevision } from "../packages/db/src/repositories/discussion-management";
import {
  createHash,
  installCommunityReportQueryHooks,
  communityReportQueryReportRow as reportRow,
  communityReportQueryState as state,
} from "./helpers/community-report-query-harness";

installCommunityReportQueryHooks();

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
