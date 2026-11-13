import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AdminReportsSection } from "../site/src/components/admin/admin-reports-section";
import { getDictionary } from "../site/src/lib/i18n";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("../site/src/components/report-moderation-controls", () => ({
  ReportModerationControls: ({ reportId }: { reportId: string }) => (
    <button type="button" data-report={reportId}>
      Decide
    </button>
  ),
}));

vi.mock("../site/src/components/admin/admin-resource-qa-report-actions", () => ({
  AdminResourceQaReportActions: ({
    reportId,
    productId,
    threadId,
  }: {
    reportId: string;
    productId: string;
    threadId: string;
  }) => (
    <button type="button" data-qa-remove={`${reportId}:${productId}:${threadId}`}>
      Remove question and resolve
    </button>
  ),
}));

vi.mock("../site/src/components/report-evidence-links", () => ({
  ReportEvidenceLinks: () => null,
}));

it("links resource Q&A reports to the market deep link with thread preview", () => {
  const copy = getDictionary("en").admin;
  const html = renderToStaticMarkup(
    <AdminReportsSection
      locale="en"
      copy={copy}
      dateLocale="en-US"
      reportView="pending"
      reportPage={1}
      reportsOpenCount={1}
      moreReports={false}
      reportHref={(view, page) => `/admin?reportView=${view}&reportPage=${page}`}
      reports={[
        {
          id: "rpt_qa",
          type: "spam",
          targetId: "rqa_thread_1",
          reason: "Off-topic abuse",
          reporterId: "usr_r",
          targetType: "resource_qa_thread",
          createdAt: "2026-11-05T12:00:00.000Z",
          evidenceUrls: [],
          status: "open",
          targetPreview: {
            title: "Racing HUD",
            href: "/market/racing-hud?qa=rqa_thread_1#resource-qa",
            detail: "How do I bypass the license check?",
            productId: "prd_hud",
            revision: 2,
            removable: true,
          },
        },
      ]}
    />,
  );

  expect(html).toContain("Racing HUD");
  expect(html).toContain("How do I bypass the license check?");
  expect(html).toContain('href="/market/racing-hud?qa=rqa_thread_1#resource-qa"');
  expect(html).toContain(copy.openReportedTarget);
  expect(html).toContain("Resource Q&amp;A");
  expect(html).not.toContain("· resource_qa_thread ·");
  expect(html).toContain("rqa_thread_1");
  expect(html).toContain('data-qa-remove="rpt_qa:prd_hud:rqa_thread_1"');
  expect(html).toContain('data-report="rpt_qa"');
  expect(html).toContain('id="report-rpt_qa"');
});

it("exposes staff moderation deep links for content report targets", () => {
  const copy = getDictionary("en").admin;
  const html = renderToStaticMarkup(
    <AdminReportsSection
      locale="en"
      copy={copy}
      dateLocale="en-US"
      reportView="pending"
      reportPage={1}
      reportsOpenCount={1}
      moreReports={false}
      focusedReportId="rpt_content"
      reportHref={(view, page) => `/admin?reportView=${view}&reportPage=${page}`}
      reports={[
        {
          id: "rpt_content",
          type: "abuse",
          targetId: "cnt_guide",
          reason: "Stolen article",
          reporterId: "usr_r",
          targetType: "content",
          createdAt: "2026-11-05T12:00:00.000Z",
          evidenceUrls: [],
          status: "open",
          targetPreview: {
            title: "Guide",
            href: "/articles/guide",
            moderationHref: "/admin/community/cnt_guide",
            detail: null,
          },
        },
      ]}
    />,
  );

  expect(html).toContain('href="/articles/guide"');
  expect(html).toContain('href="/admin/community/cnt_guide"');
  expect(html).toContain(copy.openStaffModeration);
  expect(html).toContain('id="report-rpt_content"');
  expect(html).toContain('data-report-focus="true"');
});
