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
  communityReportGroupsQueryInput as input,
  installCommunityReportGroupsQueryHooks,
  communityReportGroupsQueryPublicationRows as publicationRows,
  communityReportGroupsQueryState as state,
} from "./helpers/community-report-groups-query-harness";

installCommunityReportGroupsQueryHooks();

it("reads a bounded publication report page with literal filters and current publication context", async () => {
  state.rows = [[["moderator"]], [["post", "Title", "draft", "Body", false]], []];
  const result = await repo.publicationReports("staff", "post", {
    page: 2,
    view: "history",
    type: "spam",
    query: "100%_",
  });
  expect(result).toMatchObject({
    publication: { id: "post", status: "draft" },
    page: 2,
    view: "history",
    items: [],
  });
  expect(state.queries[2].params).toEqual(
    expect.arrayContaining([
      "content",
      "post",
      "resolved",
      "dismissed",
      "spam",
      "%100\\%\\_%",
      21,
      20,
    ]),
  );
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
});
it("previews publication batches under shared lock ordering and binds the complete text/revision without exposing its digest", async () => {
  publicationRows();
  const result = await repo.previewPublicationBatch("staff", "post", input);
  expect(result.commentId).toBeNull();
  expect(result.publication.text).toBe("Full publication");
  expect(state.queries).toHaveLength(4);
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[1].sql).toContain("sha256(convert_to(jsonb_build_array(");
  expect(state.queries[3].params).toEqual(["content", "post", "report"]);
  expect(state.queries.some((query) => query.sql.includes('from "comments"'))).toBe(false);
  expect(JSON.stringify(result.items)).not.toContain("private-reporter");
});
it("commits all and only reviewed publication reports with one update and mandatory audit", async () => {
  publicationRows();
  const preview = await repo.previewPublicationBatch("staff", "post", input);
  state.queries = [];
  publicationRows();
  state.rows.push([["report", "resolved"]]);
  const result = await repo.decidePublicationBatch(
    "staff",
    "post",
    { ...input, previewRevision: preview.previewRevision },
    ["audit"],
    "session",
  );
  expect(result.items).toEqual([
    { id: "report", status: "resolved", reporterId: "private-reporter" },
  ]);
  const writes = state.queries.filter((query) => /^(insert|update|delete)/u.test(query.sql));
  expect(writes).toHaveLength(2);
  expect(writes[0].params).toEqual(expect.arrayContaining(["content", "post", "report"]));
  expect(writes[1].params).toContain(
    JSON.stringify({
      notes: "Reviewed reason",
      previousStatus: "open",
      status: "resolved",
      removedCommentId: null,
      contentId: "post",
      commentId: null,
      previewRevision: preview.previewRevision,
      batchSize: 1,
    }),
  );
});
it.each(["publication", "report", "staff"])(
  "rejects a changed %s after review before writing",
  async (changed) => {
    publicationRows();
    const preview = await repo.previewPublicationBatch("staff", "post", input);
    state.queries = [];
    publicationRows(
      changed === "publication"
        ? { digest: "b".repeat(64) }
        : changed === "report"
          ? { reportDigest: "b".repeat(64) }
          : { finalRole: "user" },
    );
    await expect(
      repo.decidePublicationBatch(
        "staff",
        "post",
        { ...input, previewRevision: preview.previewRevision },
        ["audit"],
        "session",
      ),
    ).rejects.toMatchObject({ statusCode: changed === "staff" ? 403 : 409 });
    expect(state.queries.some((query) => /^(insert|update|delete)/u.test(query.sql))).toBe(false);
  },
);
it("fails closed on a foreign target/report selection and mandatory audit failure", async () => {
  state.rows = [[["moderator"]], []];
  await expect(repo.previewPublicationBatch("staff", "foreign", input)).rejects.toMatchObject({
    statusCode: 404,
  });
  publicationRows();
  state.rows[3] = [];
  await expect(repo.previewPublicationBatch("staff", "post", input)).rejects.toMatchObject({
    statusCode: 404,
  });
  publicationRows();
  const preview = await repo.previewPublicationBatch("staff", "post", input);
  publicationRows();
  state.rows.push([["report", "resolved"]]);
  state.failAudit = true;
  await expect(
    repo.decidePublicationBatch(
      "staff",
      "post",
      { ...input, previewRevision: preview.previewRevision },
      ["audit"],
      "session",
    ),
  ).rejects.toThrow(/audit failure|audit_events/u);
});
