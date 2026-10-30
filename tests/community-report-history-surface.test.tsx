import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  session: vi.fn(),
  page: vi.fn(),
  rate: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mock.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mock.session },
}));
vi.mock("../apps/web/src/lib/services/community-report-history-service", () => ({
  communityReportHistoryService: { page: mock.page },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mock.rate }));

import { CommunityReportHistory } from "../apps/web/src/components/community-report-history";
import {
  CommunityReportHistoryPage,
  reportHistoryMetadata,
} from "../apps/web/src/components/community-report-history-page";
import type { ReportHistoryPage } from "../apps/web/src/lib/community-report-history-contract";
import { reportHistoryCopy } from "../apps/web/src/lib/community-report-history-copy";

const stamp = "2026-10-12T00:00:00.123456Z",
  filters = { period: "all" as const, group: "all" as const, query: "" };
const event = {
  id: "audit",
  action: "report.review" as const,
  createdAt: stamp,
  from: "open" as const,
  to: "under_review" as const,
  by: "staff" as const,
  removed: false,
};
const page: ReportHistoryPage = {
  report: { id: "report", targetType: "comment", type: "abuse", status: "under_review" },
  audience: "requester",
  period: "all",
  group: "all",
  until: stamp,
  items: [event],
  hasMore: false,
  nextCursor: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.locale = "en";
  mock.session.mockResolvedValue({ id: "owner", role: "user" });
  mock.rate.mockResolvedValue({ success: true });
  mock.page.mockResolvedValue(page);
});
it.each(["en", "ru"] as const)(
  "renders localized native filters, recorded stages and a bounded private receipt in %s",
  (locale) => {
    const copy = reportHistoryCopy(locale),
      html = renderToStaticMarkup(
        <CommunityReportHistory page={page} filters={filters} locale={locale} />,
      );
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.ownHint);
    expect(html).toContain(copy.actions["report.review"]);
    expect(html).toContain('method="get"');
    expect(html).toContain('name="period"');
    expect(html).toContain('name="group"');
    expect(html).toContain("border border-base bg-surface text-secondary");
    expect(html).toContain(stamp);
    expect(html).toContain("/workspace/reports/report/history");
    expect(html).toContain("/api/workspace/reports/report/history/export?until=");
    expect(html).not.toContain(copy.notes);
  },
);
it("renders escaped staff notes, batch context and staff-only export paths", () => {
  const staff: ReportHistoryPage = {
    ...page,
    audience: "staff",
    items: [{ ...event, notes: "<script>PRIVATE_STAFF_NOTE</script>", batchSize: 2 }],
  };
  const html = renderToStaticMarkup(
    <CommunityReportHistory page={staff} filters={filters} locale="ru" />,
  );
  expect(html).toContain("PRIVATE_STAFF_NOTE");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("/api/admin/reports/report/history/export");
  expect(html).toContain(reportHistoryCopy("ru").batch);
  const poisoned = { ...staff, audience: "requester" as const } as unknown as ReportHistoryPage;
  const own = renderToStaticMarkup(
    <CommunityReportHistory page={poisoned} filters={filters} locale="ru" />,
  );
  expect(own).not.toContain("PRIVATE_STAFF_NOTE");
  expect(own).not.toContain(reportHistoryCopy("ru").batch);
});
it("shows explicit empty or unknown evidence without inventing a status transition", () => {
  const empty = renderToStaticMarkup(
    <CommunityReportHistory page={{ ...page, items: [] }} filters={filters} locale="en" />,
  );
  expect(empty).toContain(reportHistoryCopy("en").empty);
  expect(empty).toContain('role="status"');
  const unknown = renderToStaticMarkup(
    <CommunityReportHistory
      page={{ ...page, items: [{ ...event, from: null, to: null, by: "unknown" }] }}
      filters={filters}
      locale="en"
    />,
  );
  expect(unknown).toContain(reportHistoryCopy("en").unknown);
  expect(unknown).toContain(reportHistoryCopy("en").by.unknown);
});
it("keeps authentication, query validation and live authority errors ahead of private rendering", async () => {
  mock.session.mockResolvedValue(null);
  expect(
    renderToStaticMarkup(
      await CommunityReportHistoryPage({ id: "report", searchParams: Promise.resolve({}) }),
    ),
  ).toContain("/auth/login");
  expect(mock.page).not.toHaveBeenCalled();
  mock.session.mockResolvedValue({ id: "owner", role: "moderator" });
  expect(
    renderToStaticMarkup(
      await CommunityReportHistoryPage({
        id: "report",
        searchParams: Promise.resolve({ group: ["all", "review"] }),
      }),
    ),
  ).toContain(reportHistoryCopy("en").invalid);
  expect(mock.page).not.toHaveBeenCalled();
  mock.page.mockRejectedValue(new AppError("revoked", 403, "FORBIDDEN"));
  const html = renderToStaticMarkup(
    await CommunityReportHistoryPage({
      id: "report",
      staff: true,
      searchParams: Promise.resolve({}),
    }),
  );
  expect(html).toContain('role="alert"');
  expect(mock.page).toHaveBeenCalledWith(
    { id: "owner", role: "moderator" },
    "report",
    expect.anything(),
    true,
  );
  expect(html).not.toContain("Recorded submission");
});
it("localizes private metadata and limits server-rendered reads", async () => {
  mock.locale = "ru";
  expect(await reportHistoryMetadata()).toEqual({
    title: reportHistoryCopy("ru").title,
    robots: { index: false, follow: false },
  });
  mock.rate.mockResolvedValue({ success: false });
  expect(
    renderToStaticMarkup(
      await CommunityReportHistoryPage({ id: "report", searchParams: Promise.resolve({}) }),
    ),
  ).toContain('role="alert"');
  expect(mock.page).not.toHaveBeenCalled();
});
