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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/workspace/reports",
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => mock.locale,
}));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: mock.session },
}));
vi.mock("../../src/lib/services/community/community-report-groups-service", () => ({
  communityReportGroupsService: { page: mock.groups },
}));
vi.mock("../../src/lib/services/community/community-report-service", () => ({
  communityReportService: { publicationReports: mock.reports },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mock.rate }));

import { communityReportCopy } from "../../src/features/community/community-report-copy";
import type { ReportGroupsPage } from "../../src/features/community/community-report-groups-contract";
import { reportGroupsCopy } from "../../src/features/community/community-report-groups-copy";
import { CommunityReportGroups } from "../../src/features/community/components/community-report-groups";
import { reportBatchCopy } from "../../src/features/community/report-batch-copy";
import {
  CommunityReportGroupsPage,
  reportGroupsMetadata,
} from "../../src/features/community/server/community-report-groups-page";
import {
  PublicationReportsPage,
  publicationReportsMetadata,
} from "../../src/features/community/server/publication-reports-page";

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
    expect(html).toContain(`<search aria-label="${reportGroupsCopy(locale).search}"`);
    expect(html).toContain('method="get"');
    expect(html).toContain('name="period"');
    expect(html).toContain("border border-base bg-surface text-secondary");
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
  const copy = reportGroupsCopy("ru"),
    empty = renderToStaticMarkup(
      <CommunityReportGroups page={{ ...page, items: [] }} filters={filters} locale="ru" />,
    );
  expect(empty).toContain(copy.emptyFiltered);
  expect(empty).toContain(copy.reset);
  expect(empty).toContain("/admin/reports/targets");
  expect(empty).toContain("overflow-x-clip");
  const lifetime = renderToStaticMarkup(
    <CommunityReportGroups
      page={{ ...page, items: [] }}
      filters={{ period: "all", view: "pending", group: "all", query: "" }}
      locale="ru"
    />,
  );
  expect(lifetime).toContain(copy.empty);
  expect(lifetime).toContain("overflow-x-clip");
  expect(lifetime).not.toContain(copy.emptyFiltered);
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
    expect(html).toContain(`<search aria-label="${reportGroupsCopy(locale).search}"`);
    expect(html).toContain(reportBatchCopy(locale).publicationHelp);
    expect(html).toContain(reportBatchCopy(locale).preview);
    expect(html).toContain("border border-base bg-surface text-secondary");
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
  const revoked = renderToStaticMarkup(
    await CommunityReportGroupsPage({ searchParams: Promise.resolve({}) }),
  );
  expect(revoked).toContain('role="alert"');
  expect(revoked).toContain("overflow-x-clip");
  expect(revoked).toContain("/admin/reports/targets");
  const invalid = renderToStaticMarkup(
    await PublicationReportsPage({
      id: "post",
      searchParams: Promise.resolve({ target: "comment" }),
    }),
  );
  expect(invalid).toContain('role="alert"');
  expect(invalid).toContain(`>${reportGroupsCopy("en").publicationTitle}</h1>`);
  expect(mock.reports).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "preserves grouped report filters when the session is unavailable in %s",
  async (locale) => {
    mock.locale = locale;
    mock.session.mockRejectedValueOnce(new Error("PRIVATE_SESSION"));
    const html = renderToStaticMarkup(
      await CommunityReportGroupsPage({
        searchParams: Promise.resolve({ q: "a & b", view: "history" }),
      }),
    );
    expect(html).toContain(`>${reportGroupsCopy(locale).title}</h1>`);
    expect(html).toContain(reportGroupsCopy(locale).unavailable);
    expect(html).toContain('href="/admin/reports/targets?q=a+%26+b&amp;view=history"');
    expect(html).not.toContain("/auth/login");
    expect(html).not.toContain("PRIVATE_SESSION");
    expect(mock.groups).not.toHaveBeenCalled();
    expect(mock.rate).not.toHaveBeenCalled();
  },
);
it.each(["en", "ru"] as const)(
  "preserves publication report filters when session lookup fails in %s",
  async (locale) => {
    mock.locale = locale;
    mock.session.mockRejectedValueOnce(new Error("PRIVATE_SESSION"));
    const html = renderToStaticMarkup(
      await PublicationReportsPage({
        id: "post",
        searchParams: Promise.resolve({ q: "a & b", view: "history" }),
      }),
    );
    expect(html).toContain(`>${reportGroupsCopy(locale).publicationTitle}</h1>`);
    expect(html).toContain(communityReportCopy(locale).unavailable);
    expect(html).toContain('href="/admin/community/post/reports?q=a+%26+b&amp;view=history"');
    expect(html).not.toContain("PRIVATE_SESSION");
    expect(html).not.toContain("/auth/login");
    expect(mock.reports).not.toHaveBeenCalled();
    expect(mock.rate).not.toHaveBeenCalled();
  },
);
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
