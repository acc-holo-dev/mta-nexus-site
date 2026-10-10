import { expect, it } from "vitest";
import {
  communityReportCreateSchema,
  communityReportDecisionSchema,
  parseCommunityReportQuery,
  communityReportPageQuery,
  confirmsReportDecision,
} from "../apps/web/src/lib/community-report-contract";
import {
  communityReportCopy,
  communityReportError,
  communityReportDecisionError,
  communityReportMutationError,
} from "../apps/web/src/lib/community-report-copy";
import { formatNotification } from "../apps/web/src/lib/notification-copy";
import { getDictionary } from "../apps/web/src/lib/i18n";
const report = {
  targetType: "comment",
  targetId: "comment",
  type: "abuse",
  reason: "  Abuse details  ",
  evidenceUrls: ["https://evidence.test/a"],
};
it("normalizes a bounded report and rejects commercial/actor fields and unsafe evidence", () => {
  expect(communityReportCreateSchema.parse(report).reason).toBe("Abuse details");
  for (const extra of [
    { targetType: "product" },
    { reporterId: "victim" },
    { status: "resolved" },
    { reason: "short" },
    { reason: "x".repeat(1001) },
    { evidenceUrls: ["javascript:alert(1)"] },
    { evidenceUrls: Array(6).fill("https://evidence.test") },
  ])
    expect(communityReportCreateSchema.safeParse({ ...report, ...extra }).success).toBe(false);
});
it.each([
  "page=0",
  "page=10000",
  "page=01",
  "page=1&page=2",
  "view=all",
  "type=bad",
  "target=product",
  "actorId=victim",
  "cursor=x",
])("rejects invalid queue filters %s", (query) => {
  expect(parseCommunityReportQuery(new URLSearchParams(query))).toBeNull();
});
it("bounds pages and preserves valid filters through SSR", () => {
  expect(
    parseCommunityReportQuery(
      new URLSearchParams("page=9999&view=history&target=comment&type=spam"),
    ),
  ).toEqual({ page: 9999, view: "history", target: "comment", type: "spam" });
  expect(communityReportPageQuery({ page: ["2", "0"], target: "content" }).page).toBe(2);
  expect(communityReportPageQuery({ page: "invalid", actorId: "victim" }).page).toBe(1);
});
it("requires exact target revision for removal and no irrelevant revisions on other decisions", () => {
  const decision = {
    action: "remove_comment",
    expectedStatus: "under_review",
    notes: "  Spam  ",
    expectedRevision: "a".repeat(64),
  };
  expect(communityReportDecisionSchema.parse(decision).notes).toBe("Spam");
  for (const extra of [
    { expectedRevision: undefined },
    { expectedRevision: "bad" },
    { expectedStatus: "resolved" },
    { actorId: "victim" },
    { notes: "  " },
    { action: "resolve" },
  ])
    expect(communityReportDecisionSchema.safeParse({ ...decision, ...extra }).success).toBe(false);
});
it("confirms identity, action, state and removal before showing a saved decision", () => {
  expect(
    confirmsReportDecision(
      { id: "report", action: "remove_comment", status: "resolved", removed: true },
      "report",
      "remove_comment",
    ),
  ).toBe(true);
  for (const extra of [
    { id: "other" },
    { action: "resolve" },
    { status: "dismissed" },
    { removed: false },
  ])
    expect(
      confirmsReportDecision(
        { id: "report", action: "remove_comment", status: "resolved", removed: true, ...extra },
        "report",
        "remove_comment",
      ),
    ).toBe(false);
  expect(confirmsReportDecision({ success: true }, "report", "resolve")).toBe(false);
});
it.each(["en", "ru"] as const)(
  "localizes errors, uncertain writes and privacy-safe notifications in %s",
  (locale) => {
    const copy = communityReportCopy(locale);
    expect(communityReportError(locale, "COMMENT_CHANGED")).toBe(copy.commentChanged);
    expect(communityReportError(locale, "REPORT_STATE_CHANGED")).toBe(copy.changed);
    expect(communityReportMutationError(locale, "UNCONFIRMED")).toBe(copy.mutationUnavailable);
    expect(communityReportDecisionError(locale, "INTERNAL_ERROR")).toBe(copy.decisionUnavailable);
    const notice = formatNotification(
      { title: "Community report status", message: "Report status: resolved." },
      getDictionary(locale).buildReviewNotifications,
      locale,
    );
    expect(notice.message).toBe(locale === "ru" ? "Жалоба решена." : "Report status: resolved.");
    expect(
      formatNotification(
        { title: "New community report", message: "A community report is awaiting review." },
        getDictionary(locale).buildReviewNotifications,
        locale,
      ).title,
    ).toBe(locale === "ru" ? "Новая жалоба сообщества" : "New community report");
  },
);
