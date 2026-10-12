import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  session: vi.fn(),
  groups: vi.fn(),
  reports: vi.fn(),
  rate: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mock.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mock.session },
}));
vi.mock("../apps/web/src/lib/services/community-report-groups-service", () => ({
  communityReportGroupsService: { page: mock.groups },
}));
vi.mock("../apps/web/src/lib/services/community-report-service", () => ({
  communityReportService: { publicationReports: mock.reports },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mock.rate }));

import { CommunityReportGroups } from "../apps/web/src/components/community-report-groups";
import {
  CommunityReportGroupsPage,
  reportGroupsMetadata,
} from "../apps/web/src/components/community-report-groups-page";
import {
  PublicationReportsPage,
  publicationReportsMetadata,
} from "../apps/web/src/components/publication-reports-page";
import type { ReportGroupsPage } from "../apps/web/src/lib/community-report-groups-contract";
import { reportGroupsCopy } from "../apps/web/src/lib/community-report-groups-copy";
import { reportBatchCopy } from "../apps/web/src/lib/report-batch-copy";

const stamp = "2026-10-12T00:00:00.123456Z",
  filters = {
    period: "all" as const,
    view: "pending" as const,
    group: "all" as const,
    query: "100%_",
    type: "spam",
  };
const row = {
  targetType: "content" as const,
  targetId: "post",
  firstAt: stamp,
  lastAt: stamp,
  open: 2,
  review: 1,
  resolved: 3,
  dismissed: 4,
  reportHref: "/admin/reports/report",
  target: {
    contentId: "post",
    title: "<script>Title</script>",
    status: "published" as const,
    text: null,
  },
};
const page: ReportGroupsPage = {
  period: "all",
  view: "pending",
  query: "100%_",
  target: null,
  type: "spam",
  until: stamp,
  items: [
    row,
    {
      ...row,
      targetType: "comment",
      targetId: "comment",
      target: { ...row.target, text: "<img onerror=x>" },
    },
  ],
  hasMore: false,
  nextCursor: null,
};
const reports = {
  publication: {
    id: "post",
    title: "Title",
    status: "published",
    text: "<script>Private draft body</script>",
    truncated: true,
  },
  items: [
    {
      id: "report",
      type: "abuse",
      reason: "Reason",
      status: "open",
      createdAt: stamp,
      resolvedAt: null,
    },
  ],
  hasMore: true,
  page: 1,
  view: "pending",
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.locale = "en";
  mock.session.mockResolvedValue({ id: "staff", role: "moderator" });
  mock.rate.mockResolvedValue({ success: true });
  mock.groups.mockResolvedValue(page);
  mock.reports.mockResolvedValue(reports);
});
it.each(["en", "ru"] as const)(
  "renders localized counts, native filters and real publication/comment moderation links in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <CommunityReportGroups page={page} filters={filters} locale={locale} />,
    );
    expect(html).toContain(reportGroupsCopy(locale).title);
    expect(html).toContain('method="get"');
    expect(html).toContain('name="period"');
    expect(html).toMatch(/maxlength="80"/iu);
    expect(html).toContain("/admin/community/post/reports?view=pending");
    expect(html).toContain("/admin/community/post/discussion/comment/reports?view=pending");
    expect(html).toContain("type=spam");
    expect(html).toContain("q=100%25_");
    expect(html).toContain("period=all");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  },
);
it("keeps unavailable targets actionable only through an individual report and displays empty state separately", () => {
  const html = renderToStaticMarkup(
    <CommunityReportGroups
      page={{ ...page, items: [{ ...row, target: null }] }}
      filters={filters}
      locale="ru"
    />,
  );
  expect(html).toContain(reportGroupsCopy("ru").unknown);
  expect(html).toContain("/admin/reports/report");
  expect(html).not.toContain("/admin/community/");
  const empty = renderToStaticMarkup(
    <CommunityReportGroups page={{ ...page, items: [] }} filters={filters} locale="ru" />,
  );
  expect(empty).toContain(reportGroupsCopy("ru").empty);
  expect(empty).toContain('role="status"');
});
it.each(["en", "ru"] as const)(
  "renders publication context, working batch controls and retained report filters in %s",
  async (locale) => {
    mock.locale = locale;
    const html = renderToStaticMarkup(
      await PublicationReportsPage({
        id: "post",
        searchParams: Promise.resolve({ q: "100%_", type: "spam" }),
      }),
    );
    expect(html).toContain(reportGroupsCopy(locale).publicationTitle);
    expect(html).toContain(reportBatchCopy(locale).publicationHelp);
    expect(html).toContain(reportBatchCopy(locale).preview);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("page=2");
    expect(html).toContain("q=100%25_");
    expect(mock.reports).toHaveBeenCalledWith(
      { id: "staff", role: "moderator" },
      "post",
      expect.objectContaining({ query: "100%_", type: "spam" }),
    );
  },
);
it("gates anonymous and revoked staff and rejects malformed scopes before private rendering", async () => {
  mock.session.mockResolvedValue(null);
  expect(
    renderToStaticMarkup(await CommunityReportGroupsPage({ searchParams: Promise.resolve({}) })),
  ).toContain("/auth/login");
  expect(mock.groups).not.toHaveBeenCalled();
  mock.session.mockResolvedValue({ id: "staff", role: "moderator" });
  expect(
    renderToStaticMarkup(
      await CommunityReportGroupsPage({ searchParams: Promise.resolve({ q: ["x", "y"] }) }),
    ),
  ).toContain(reportGroupsCopy("en").invalid);
  mock.groups.mockRejectedValue(new AppError("revoked", 403, "FORBIDDEN"));
  expect(
    renderToStaticMarkup(await CommunityReportGroupsPage({ searchParams: Promise.resolve({}) })),
  ).toContain('role="alert"');
  const invalid = renderToStaticMarkup(
    await PublicationReportsPage({
      id: "post",
      searchParams: Promise.resolve({ target: "comment" }),
    }),
  );
  expect(invalid).toContain('role="alert"');
  expect(mock.reports).not.toHaveBeenCalled();
});
it("localizes private metadata and does not load groups after an exhausted rate", async () => {
  mock.locale = "ru";
  expect((await reportGroupsMetadata()).title).toBe(reportGroupsCopy("ru").title);
  expect((await publicationReportsMetadata()).robots).toEqual({ index: false, follow: false });
  mock.rate.mockResolvedValue({ success: false });
  expect(
    renderToStaticMarkup(await CommunityReportGroupsPage({ searchParams: Promise.resolve({}) })),
  ).toContain('role="alert"');
  expect(mock.groups).not.toHaveBeenCalled();
});
