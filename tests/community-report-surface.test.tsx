import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/community-report-service", () => ({
  communityReportService: mocks,
}));

import { CommunityReportDetailView } from "../apps/web/src/components/community-report-detail";
import { CommunityReportForm } from "../apps/web/src/components/community-report-form";
import { CommunityReportList } from "../apps/web/src/components/community-report-list";
import { CommunityReportScreen } from "../apps/web/src/components/community-report-screen";
import type { CommunityReportDetail } from "../apps/web/src/lib/community-report-contract";
import { communityReportCopy } from "../apps/web/src/lib/community-report-copy";

const row: CommunityReportDetail = {
  id: "report",
  targetType: "comment",
  targetId: "comment",
  type: "abuse",
  reason: "<script>private claim</script>",
  evidenceUrls: ["https://safe.test", "javascript:alert(1)"],
  status: "open",
  createdAt: "2026-10-10T00:00:00Z",
  resolvedAt: null,
  target: {
    kind: "comment",
    title: "Title",
    text: "<img src=x onerror=alert(1)>",
    truncated: false,
    author: "author",
    status: "published",
    href: "/articles/title#comment-comment",
    revision: "a".repeat(64),
  },
  moderatorNotes: "STAFF_PRIVATE",
  reporterId: "REPORTER_PRIVATE",
};
const filters = { view: "pending" as const, page: 2, target: "comment" as const, type: "abuse" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.session.mockResolvedValue({ id: "actor", role: "user" });
  mocks.page.mockResolvedValue({ items: [], hasMore: false, page: 1, view: "pending" });
  mocks.detail.mockResolvedValue(row);
});
it.each(["en", "ru"] as const)(
  "renders localized bounded filters, escaped reports and real pagination in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <CommunityReportList
        initial={{ items: [row], hasMore: true, page: 2, view: "pending" }}
        filters={filters}
        locale={locale}
      />,
    );
    expect(html).toContain(communityReportCopy(locale).category);
    expect(html).toContain('name="target"');
    expect(html).toContain('name="type"');
    expect(html).toContain("page=3");
    expect(html).toContain("page=1");
    expect(html).toContain("target=comment");
    expect(html).toContain('href="/workspace/reports/report"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  },
);
it("distinguishes empty, failed reads and confirmed target-unavailable reports", () => {
  const failure = renderToStaticMarkup(
    <CommunityReportList initial={null} filters={filters} locale="en" />,
  );
  expect(failure).toContain('role="alert"');
  expect(failure).not.toContain(communityReportCopy("en").empty);
  const empty = renderToStaticMarkup(
    <CommunityReportList
      initial={{ items: [], hasMore: false, page: 2, view: "pending" }}
      filters={filters}
      locale="en"
    />,
  );
  expect(empty).toContain(communityReportCopy("en").empty);
  const detail = renderToStaticMarkup(
    <CommunityReportDetailView id="report" initial={{ ...row, target: null }} locale="en" />,
  );
  expect(detail).toContain(communityReportCopy("en").missing);
  expect(detail).not.toContain(communityReportCopy("en").remove_comment);
});
it.each(["en", "ru"] as const)(
  "keeps staff notes/actions private and escapes target content in %s",
  (locale) => {
    const owner = renderToStaticMarkup(
      <CommunityReportDetailView id="report" initial={row} locale={locale} />,
    );
    expect(owner).not.toContain("STAFF_PRIVATE");
    expect(owner).not.toContain("REPORTER_PRIVATE");
    expect(owner).not.toContain(communityReportCopy(locale).remove_comment);
    expect(owner).toContain("&lt;img");
    expect(owner).not.toContain("javascript:");
    const staff = renderToStaticMarkup(
      <CommunityReportDetailView id="report" initial={row} locale={locale} staff />,
    );
    expect(staff).toContain("STAFF_PRIVATE");
    expect(staff).toContain(communityReportCopy(locale).remove_comment);
    expect(staff).toContain("disabled");
    expect(staff).toMatch(/maxlength="2000"/iu);
    const closed = renderToStaticMarkup(
      <CommunityReportDetailView
        id="report"
        initial={{ ...row, status: "resolved" }}
        locale={locale}
        staff
      />,
    );
    expect(closed).not.toContain(communityReportCopy(locale).remove_comment);
  },
);
it("renders the report entry point with an accessible target-independent label", () => {
  expect(
    renderToStaticMarkup(
      <CommunityReportForm targetType="comment" targetId="comment" locale="ru" authenticated />,
    ),
  ).toContain(communityReportCopy("ru").report);
});
it("does not load private data for anonymous users or nonstaff on staff screens", async () => {
  mocks.session.mockResolvedValue(null);
  expect(renderToStaticMarkup(await CommunityReportScreen({}))).toContain('href="/auth/login"');
  mocks.session.mockResolvedValue({ id: "actor", role: "user" });
  expect(renderToStaticMarkup(await CommunityReportScreen({ staff: true }))).toContain(
    communityReportCopy("en").forbidden,
  );
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.detail).not.toHaveBeenCalled();
});
it("binds SSR reads to the current actor and treats another user's report as not found", async () => {
  await CommunityReportScreen({
    searchParams: Promise.resolve({ page: "2", target: "comment", type: "abuse" }),
  });
  expect(mocks.page).toHaveBeenCalledWith({ id: "actor", role: "user" }, filters, false);
  mocks.detail.mockRejectedValue(new AppError("private target", 404, "NOT_FOUND"));
  await expect(CommunityReportScreen({ id: "report" })).rejects.toThrow("NOT_FOUND");
});

it("shows retained staff discussion context after removal and hides unsupported target deletion", () => {
  const removed = renderToStaticMarkup(
    <CommunityReportDetailView
      id="report"
      initial={{ ...row, target: null, moderationHref: "/admin/community/post/discussion/comment" }}
      locale="en"
      staff
    />,
  );
  expect(removed).toContain("/admin/community/post/discussion/comment");
  expect(removed).not.toContain(communityReportCopy("en").remove_comment);
  const unsupported = renderToStaticMarkup(
    <CommunityReportDetailView
      id="report"
      initial={{ ...row, moderationHref: null }}
      locale="en"
      staff
    />,
  );
  expect(unsupported).not.toContain(communityReportCopy("en").remove_comment);
  expect(unsupported).toContain(communityReportCopy("en").resolve);
  const own = renderToStaticMarkup(
    <CommunityReportDetailView
      id="report"
      initial={{ ...row, moderationHref: "/admin/community/post/discussion/comment" }}
      locale="en"
    />,
  );
  expect(own).not.toContain("/admin/community/post/discussion/comment");
});
