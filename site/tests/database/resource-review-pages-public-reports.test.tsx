import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import {
  mocks,
  review,
  setupResourceReviewPages,
  state,
} from "../helpers/resource-review-pages-harness";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/library/review/prd_a",
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../../src/lib/i18n-server", async () => {
  const { state: harnessState } = await import("../helpers/resource-review-pages-harness");
  return { getRequestLocale: async () => harnessState.locale };
});
vi.mock("../../src/lib/services/auth-service", async () => {
  const { state: harnessState } = await import("../helpers/resource-review-pages-harness");
  return { authService: { getSession: async () => harnessState.actor } };
});
vi.mock("../../src/lib/services/product-service", () => ({
  productService: {
    getProductBySlug: async () => ({
      id: "prd_a",
      slug: "resource",
      title: "<Resource>",
      status: "published",
    }),
  },
}));
vi.mock("@nexus/db", async () => {
  const { mocks: harnessMocks } = await import("../helpers/resource-review-pages-harness");
  return {
    resourceReviewsRepository: {
      ownPage: harnessMocks.ownPage,
      ownDetail: harnessMocks.ownDetail,
      publicPage: harnessMocks.publicPage,
      reportsPage: harnessMocks.reportsPage,
      reportDetail: harnessMocks.reportDetail,
    },
  };
});

setupResourceReviewPages();

import ReviewDetailLoading from "../../src/app/admin/commerce/reviews/[id]/loading";
import ReviewsLoading from "../../src/app/admin/commerce/reviews/loading";
import Public from "../../src/app/market/[slug]/reviews/page";
import { ResourceReviewReportScreen } from "../../src/components/resource-review-report-screen";
import { getDictionary } from "../../src/lib/i18n";
import { resourceReviewCopy } from "../../src/lib/resource-review-i18n";

it.each(["en", "ru"] as const)(
  "public %s reviews expose public authors, distinguish legacy evidence and preserve pages",
  async (locale) => {
    state.locale = locale;
    state.actor = null;
    const html = renderToStaticMarkup(
      await Public({
        params: Promise.resolve({ slug: "resource" }),
        searchParams: Promise.resolve({ page: "2" }),
      }),
    );
    expect(html).toContain("/users/alice");
    expect(html).toContain("review-cmt_a");
    expect(html).toContain("/market/resource/reviews?page=3");
    expect(html).toContain(locale === "ru" ? "Исторический отзыв" : "Historical review");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("verified purchase");
    expect(html).not.toContain("<script>");
    expect(html).toContain('href="/auth/login?next=%2Fmarket%2Fresource%2Freviews%3Fpage%3D2"');
    expect(html).toContain('href="/auth/register?next=%2Fmarket%2Fresource%2Freviews%3Fpage%3D2"');
    expect(html).toContain(getDictionary(locale).workspace.createAccount);
  },
);
it("authenticated resource readers can report reviews and reach their review editor", async () => {
  const html = renderToStaticMarkup(
    await Public({
      params: Promise.resolve({ slug: "resource" }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(html).toContain("Report review");
  expect(html).toContain("Report type");
  expect(html).toContain("focus-visible:ring-2");
  expect(html).toContain("/workspace/library/review/prd_a");
  expect(html).toContain("/workspace/review-reports");
});
it("private report previews do not show unavailable review text or staff notes", async () => {
  const html = renderToStaticMarkup(
    await ResourceReviewReportScreen({ staff: false, id: "rpt_a" }),
  );
  expect(html).toContain("Resource unavailable");
  expect(html).not.toContain("INTERNAL_STAFF_NOTE");
  expect(html).not.toContain("remove_review");
  expect(mocks.reportDetail).toHaveBeenCalledWith({ actorId: "usr_a", staff: false }, "rpt_a");
});
it("denies nonstaff report screens before querying the queue", async () => {
  await expect(ResourceReviewReportScreen({ staff: true })).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mocks.reportsPage).not.toHaveBeenCalled();
});
it("suggests the alternate report view when the current queue is empty", async () => {
  mocks.reportsPage.mockResolvedValueOnce({
    items: [],
    view: "history",
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const html = renderToStaticMarkup(
    await ResourceReviewReportScreen({ staff: false, query: { view: "history" } }),
  );
  expect(html).toContain("No reports in this view.");
  expect(html).toContain("Pending");
  expect(html).toContain('href="/workspace/review-reports?view=pending"');
});

it("report history keeps its filters while paging", async () => {
  const html = renderToStaticMarkup(
    await ResourceReviewReportScreen({ staff: false, query: { view: "history", page: "2" } }),
  );
  expect(html).toContain("page=3&amp;view=history");
  expect(html).toContain("focus-visible:outline-[var(--nexus-accent)]");
  expect(mocks.reportsPage).toHaveBeenCalledWith({ actorId: "usr_a", staff: false }, 2, "history");
});
it("current staff get removal only with an existing published revision", async () => {
  state.actor = { id: "usr_staff", role: "moderator" };
  mocks.reportDetail.mockResolvedValue({
    id: "rpt_a",
    status: "open",
    reason: "Complaint",
    review: { ...review, title: "Resource" },
  });
  let html = renderToStaticMarkup(await ResourceReviewReportScreen({ staff: true, id: "rpt_a" }));
  expect(html).toContain("remove_review");
  expect(html).toContain("shown to the review author");
  mocks.reportDetail.mockResolvedValue({
    id: "rpt_a",
    status: "open",
    reason: "Complaint",
    review: null,
  });
  html = renderToStaticMarkup(await ResourceReviewReportScreen({ staff: true, id: "rpt_a" }));
  expect(html).not.toContain("remove_review");
  expect(html).toContain("dismiss");
});
it("shows an honest recovery state when the report queue fails", async () => {
  mocks.reportsPage.mockRejectedValue(new Error("queue unavailable"));
  const copy = resourceReviewCopy("en");
  const html = renderToStaticMarkup(
    await ResourceReviewReportScreen({ staff: false, query: { view: "history", page: "2" } }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain(copy.loadUnavailableHint);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-h-11");
  expect(html).toContain("view=history&amp;page=2");
});
it("shows an honest recovery state when a report detail fails", async () => {
  state.actor = { id: "usr_staff", role: "moderator" };
  mocks.reportDetail.mockRejectedValue(new Error("detail unavailable"));
  const copy = resourceReviewCopy("en");
  const html = renderToStaticMarkup(await ResourceReviewReportScreen({ staff: true, id: "rpt_a" }));
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain(copy.loadUnavailableHint);
  expect(html).toContain('href="/admin/commerce/reviews/rpt_a"');
  expect(html).not.toContain("INTERNAL_STAFF_NOTE");
});
it("clips honest loading shells on narrow layouts", async () => {
  for (const Loading of [ReviewsLoading, ReviewDetailLoading]) {
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain("min-w-0 max-w-5xl");
    expect(html).toContain("overflow-x-clip");
  }
});
it.each(["en", "ru"] as const)(
  "public %s reviews show EmptyState when the list is empty",
  async (locale) => {
    state.locale = locale;
    state.actor = null;
    mocks.publicPage.mockResolvedValueOnce({
      reviews: [],
      page: 1,
      totalPages: 1,
      total: 0,
    });
    const copy = resourceReviewCopy(locale);
    const html = renderToStaticMarkup(
      await Public({
        params: Promise.resolve({ slug: "resource" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain(copy.empty);
    expect(html).toContain(copy.emptyHint);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
  },
);
it.each(["en", "ru"] as const)(
  "public %s reviews show ErrorState recovery when the page read fails",
  async (locale) => {
    state.locale = locale;
    state.actor = null;
    mocks.publicPage.mockRejectedValueOnce(new Error("database-secret"));
    const copy = resourceReviewCopy(locale);
    const html = renderToStaticMarkup(
      await Public({
        params: Promise.resolve({ slug: "resource" }),
        searchParams: Promise.resolve({ page: "2" }),
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.pageUnavailable);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).toContain('href="/market/resource/reviews?page=2"');
    expect(html).not.toContain("database-secret");
  },
);
it("clips the public reviews loading shell", async () => {
  const { default: MarketReviewsLoading } = await import(
    "../../src/app/market/[slug]/reviews/loading"
  );
  const html = renderToStaticMarkup(await MarketReviewsLoading());
  expect(html).toContain("min-w-0");
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(resourceReviewCopy("en").pageLoading);
});
