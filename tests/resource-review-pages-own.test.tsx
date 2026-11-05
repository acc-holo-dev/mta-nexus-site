import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import {
  mocks,
  review,
  setupResourceReviewPages,
  state,
} from "./helpers/resource-review-pages-harness";

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
vi.mock("../apps/web/src/lib/i18n-server", async () => {
  const { state: harnessState } = await import("./helpers/resource-review-pages-harness");
  return { getRequestLocale: async () => harnessState.locale };
});
vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { state: harnessState } = await import("./helpers/resource-review-pages-harness");
  return { authService: { getSession: async () => harnessState.actor } };
});
vi.mock("../apps/web/src/lib/services/product-service", () => ({
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
  const { mocks: harnessMocks } = await import("./helpers/resource-review-pages-harness");
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

import Editor from "../apps/web/src/app/workspace/library/review/[id]/page";
import Own from "../apps/web/src/app/workspace/library/reviews/page";
import { ResourceReviewEditor } from "../apps/web/src/components/resource-review-controls";
import { resourceReviewCopy } from "../apps/web/src/lib/resource-review-i18n";

it.each(["en", "ru"] as const)(
  "renders own unavailable reviews and history navigation in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Own({ searchParams: Promise.resolve({ page: "2" }) }));
    expect(html).toContain(locale === "ru" ? "Мои отзывы" : "My reviews");
    expect(html).toContain(locale === "ru" ? "Ресурс недоступен" : "Resource unavailable");
    expect(html).toContain("/workspace/library/review/prd_a");
    expect(html).toContain("page=3");
    expect(html).toContain("overflow-x-clip");
    expect(html).not.toContain("<script>");
    expect(mocks.ownPage).toHaveBeenCalledWith("usr_a", 2);
  },
);
it("shows EmptyState honesty when own reviews are empty", async () => {
  mocks.ownPage.mockResolvedValueOnce({ items: [], page: 1, totalPages: 1, total: 0 });
  const copy = resourceReviewCopy("en");
  const html = renderToStaticMarkup(await Own({ searchParams: Promise.resolve({}) }));
  expect(html).toContain(copy.empty);
  expect(html).toContain(copy.ownEmptyHint);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-h-11");
});
it("shows an honest recovery state when own reviews fail to load", async () => {
  mocks.ownPage.mockRejectedValueOnce(new Error("reviews unavailable"));
  const copy = resourceReviewCopy("en");
  const html = renderToStaticMarkup(await Own({ searchParams: Promise.resolve({ page: "2" }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.pageUnavailable);
  expect(html).toContain(copy.pageUnavailableDescription);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("page=2");
  expect(html).not.toContain("reviews unavailable");
});
it("shows an honest recovery state when own review detail fails to load", async () => {
  mocks.ownDetail.mockRejectedValueOnce(new Error("detail unavailable"));
  const copy = resourceReviewCopy("en");
  const html = renderToStaticMarkup(await Editor({ params: Promise.resolve({ id: "prd_a" }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.pageUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain('href="/workspace/library/review/prd_a"');
  expect(html).not.toContain("detail unavailable");
});
it("clips honest own-review loading shells on narrow layouts", async () => {
  const { default: OwnReviewsLoading } = await import(
    "../apps/web/src/app/workspace/library/reviews/loading"
  );
  const { default: OwnReviewDetailLoading } = await import(
    "../apps/web/src/app/workspace/library/review/[id]/loading"
  );
  const copy = resourceReviewCopy("en");
  for (const Loading of [OwnReviewsLoading, OwnReviewDetailLoading]) {
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain("min-w-0");
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain(copy.pageLoading);
  }
});
it("does not fetch private reviews while signed out", async () => {
  state.actor = null;
  expect(renderToStaticMarkup(await Own({ searchParams: Promise.resolve({}) }))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Flibrary%2Freviews"',
  );
  expect(
    renderToStaticMarkup(await Editor({ params: Promise.resolve({ id: "prd_a" }) })),
  ).toContain('href="/auth/login?next=%2Fworkspace%2Flibrary%2Freview%2Fprd_a"');
  expect(mocks.ownPage).not.toHaveBeenCalled();
});
it("expired access allows withdrawal, with no publication form", async () => {
  const html = renderToStaticMarkup(await Editor({ params: Promise.resolve({ id: "prd_a" }) }));
  expect(html).toContain("Withdraw review");
  expect(html).not.toContain("Publish review");
  expect(html).not.toContain("<textarea");
  expect(html).toContain("Reload saved state");
});
it("moderated reviews expose their reason only to their author and cannot be republished", () => {
  const html = renderToStaticMarkup(
    <ResourceReviewEditor
      productId="prd_a"
      review={{ ...review, status: "removed", moderationReason: "Repeated spam" }}
      canReview={false}
      eligibility="moderated"
      locale="ru"
    />,
  );
  expect(html).toContain("Удалён модерацией");
  expect(html).toContain("Repeated spam");
  expect(html).toContain("повторная публикация недоступна");
  expect(html).not.toContain("<form");
});

it("explains owner/manager conflict before a review can be submitted", () => {
  const html = renderToStaticMarkup(
    <ResourceReviewEditor
      productId="prd_a"
      review={null}
      canReview={false}
      eligibility="owner_conflict"
      locale="en"
    />,
  );
  expect(html).toContain("Authors, organization managers and staff cannot publish");
  expect(html).toContain("not proof of install or gameplay");
  expect(html).not.toContain("<textarea");
});
