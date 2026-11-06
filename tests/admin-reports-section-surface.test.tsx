import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AdminReportsSection } from "../apps/web/src/components/admin/admin-reports-section";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("../apps/web/src/components/report-moderation-controls", () => ({
  ReportModerationControls: ({ reportId }: { reportId: string }) => (
    <button type="button" data-report={reportId}>
      Decide
    </button>
  ),
}));

vi.mock("../apps/web/src/components/report-evidence-links", () => ({
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
          },
        },
      ]}
    />,
  );

  expect(html).toContain("Racing HUD");
  expect(html).toContain("How do I bypass the license check?");
  expect(html).toContain('href="/market/racing-hud?qa=rqa_thread_1#resource-qa"');
  expect(html).toContain(copy.openReportedTarget);
  expect(html).toContain("rqa_thread_1");
  expect(html).toContain('data-report="rpt_qa"');
});
