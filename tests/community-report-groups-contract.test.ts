import { expect, it } from "vitest";
import {
  parseReportGroupsQuery,
  reportGroupsHref,
} from "../apps/web/src/lib/community-report-groups-contract";
import {
  confirmsReportBatchCommand,
  confirmsReportBatchPreview,
} from "../apps/web/src/lib/report-batch-contract";

const stamp = "2026-10-12T00:00:00.123456Z",
  input = {
    items: [{ id: "report", expectedStatus: "open" as const }],
    action: "resolve" as const,
    notes: "Recorded reason",
  };
const preview = {
  contentId: "post",
  commentId: null,
  publication: { id: "post", status: "published", title: "Title", text: "Body", truncated: false },
  comment: null,
  action: "resolve",
  notes: "Recorded reason",
  previewRevision: "a".repeat(64),
  items: [
    {
      id: "report",
      type: "spam",
      reason: "Reason",
      createdAt: stamp,
      before: "open",
      after: "resolved",
    },
  ],
};
it("defaults to a bounded thirty-day view and preserves all-period cursors and filters through links", () => {
  expect(parseReportGroupsQuery(new URLSearchParams())).toMatchObject({
    period: "30",
    view: "pending",
    group: "all",
    query: "",
  });
  const filters = {
    period: "all" as const,
    view: "history" as const,
    group: "all" as const,
    query: "100%_",
    target: "comment" as const,
    type: "spam",
    cursor: { version: 1 as const, context: "a".repeat(64), until: stamp, id: "anchor" },
  };
  const href = reportGroupsHref(filters, undefined, { until: stamp });
  expect(href).toContain("period=all");
  expect(parseReportGroupsQuery(new URL(href, "https://nexus.test").searchParams)).toMatchObject(
    filters,
  );
  const fresh = reportGroupsHref(filters, undefined, { fresh: true });
  expect(fresh).not.toContain("cursor");
  expect(fresh).toContain("period=all");
});
it.each([
  "view=unknown",
  "period=30&period=7",
  "q=x&q=y",
  "target=product",
  "type=unknown",
  "actorId=victim",
  "group=all",
  "cursor=bad",
  "q=x%00",
  "until=2026-10-12T00:00:00.123Z",
  `q=${" ".repeat(81)}`,
])("rejects ambiguous or unsafe group filters %s", (query) => {
  expect(parseReportGroupsQuery(new URLSearchParams(query))).toBeNull();
});
it("confirms publication previews and acknowledgements with exact target, states, selection and notes", () => {
  const result = confirmsReportBatchPreview(preview, "post", null, input);
  expect(result).not.toBeNull();
  if (!result) throw Error("Missing review");
  const ack = {
    contentId: "post",
    commentId: null,
    action: "resolve",
    previewRevision: preview.previewRevision,
    items: [{ id: "report", status: "resolved" }],
  };
  expect(confirmsReportBatchCommand(ack, "post", null, result)).toBe(true);
  expect(confirmsReportBatchCommand({ ...ack, commentId: "comment" }, "post", null, result)).toBe(
    false,
  );
  expect(confirmsReportBatchPreview(preview, "post", "comment", input)).toBeNull();
});
it.each([
  { commentId: "comment" },
  { contentId: "foreign" },
  { publication: { ...preview.publication, digest: "PRIVATE" } },
  { publication: { ...preview.publication, text: "x".repeat(10001) } },
  { notes: "Changed" },
  { items: [] },
  { items: [{ ...preview.items[0], after: "dismissed" }] },
])("rejects a misleading publication preview %j", (change) => {
  expect(confirmsReportBatchPreview({ ...preview, ...change }, "post", null, input)).toBeNull();
});
