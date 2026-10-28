import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  ownPage: vi.fn(),
  ownDetail: vi.fn(),
  publicPage: vi.fn(),
  reportsPage: vi.fn(),
  reportDetail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
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
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
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
vi.mock("@nexus/db", () => ({
  resourceReviewsRepository: {
    ownPage: state.ownPage,
    ownDetail: state.ownDetail,
    publicPage: state.publicPage,
    reportsPage: state.reportsPage,
    reportDetail: state.reportDetail,
  },
}));
import Own from "../apps/web/src/app/workspace/library/reviews/page";
import Editor from "../apps/web/src/app/workspace/library/review/[id]/page";
import Public from "../apps/web/src/app/market/[slug]/reviews/page";
import { ResourceReviewReportScreen } from "../apps/web/src/components/resource-review-report-screen";
import { ResourceReviewEditor } from "../apps/web/src/components/resource-review-controls";
const now = new Date("2026-10-11T00:00:00Z"),
  bounds = { page: 2, totalPages: 3, total: 41 };
const review = {
  id: "cmt_a",
  text: "<script>private review</script>",
  rating: 3,
  status: "published" as const,
  revision: 2,
  accessSource: "legacy" as const,
  createdAt: now,
  updatedAt: null,
  author: { username: "alice", displayName: "Alice" },
};
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.ownPage.mockReset().mockResolvedValue({
    items: [{ ...review, productId: "prd_a", title: null, slug: null }],
    ...bounds,
  });
  state.ownDetail.mockReset().mockResolvedValue({
    product: { id: "prd_a", title: null, slug: null },
    review,
    canReview: false,
  });
  state.publicPage.mockReset().mockResolvedValue({ reviews: [review], ...bounds });
  state.reportsPage.mockReset().mockResolvedValue({
    items: [{ id: "rpt_a", reason: "<Complaint>", status: "open" }],
    view: "history",
    ...bounds,
  });
  state.reportDetail.mockReset().mockResolvedValue({
    id: "rpt_a",
    reason: "<Complaint>",
    status: "open",
    moderatorNotes: "INTERNAL_STAFF_NOTE",
    review: null,
  });
});
it.each(["en", "ru"] as const)(
  "renders own unavailable reviews and history navigation in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Own({ searchParams: Promise.resolve({ page: "2" }) }));
    expect(html).toContain(locale === "ru" ? "Мои отзывы" : "My reviews");
    expect(html).toContain(locale === "ru" ? "Ресурс недоступен" : "Resource unavailable");
    expect(html).toContain("/workspace/library/review/prd_a");
    expect(html).toContain("page=3");
    expect(html).not.toContain("<script>");
    expect(state.ownPage).toHaveBeenCalledWith("usr_a", 2);
  },
);
it("does not fetch private reviews while signed out", async () => {
  state.actor = null;
  expect(renderToStaticMarkup(await Own({ searchParams: Promise.resolve({}) }))).toContain(
    "/auth/login",
  );
  expect(state.ownPage).not.toHaveBeenCalled();
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
      locale="ru"
    />,
  );
  expect(html).toContain("Удалён модерацией");
  expect(html).toContain("Repeated spam");
  expect(html).not.toContain("<form");
});
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
  expect(state.reportDetail).toHaveBeenCalledWith({ actorId: "usr_a", staff: false }, "rpt_a");
});
it("denies nonstaff report screens before querying the queue", async () => {
  await expect(ResourceReviewReportScreen({ staff: true })).rejects.toThrow("NEXT_NOT_FOUND");
  expect(state.reportsPage).not.toHaveBeenCalled();
});
it("report history keeps its filters while paging", async () => {
  const html = renderToStaticMarkup(
    await ResourceReviewReportScreen({ staff: false, query: { view: "history", page: "2" } }),
  );
  expect(html).toContain("page=3&amp;view=history");
  expect(state.reportsPage).toHaveBeenCalledWith({ actorId: "usr_a", staff: false }, 2, "history");
});
it("current staff get removal only with an existing published revision", async () => {
  state.actor = { id: "usr_staff", role: "moderator" };
  state.reportDetail.mockResolvedValue({
    id: "rpt_a",
    status: "open",
    reason: "Complaint",
    review: { ...review, title: "Resource" },
  });
  let html = renderToStaticMarkup(await ResourceReviewReportScreen({ staff: true, id: "rpt_a" }));
  expect(html).toContain("remove_review");
  expect(html).toContain("shown to the review author");
  state.reportDetail.mockResolvedValue({
    id: "rpt_a",
    status: "open",
    reason: "Complaint",
    review: null,
  });
  html = renderToStaticMarkup(await ResourceReviewReportScreen({ staff: true, id: "rpt_a" }));
  expect(html).not.toContain("remove_review");
  expect(html).toContain("dismiss");
});
