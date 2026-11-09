import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  detail: vi.fn(),
  page: vi.fn(),
  orderDetail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/order-cases",
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("../../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../../apps/web/src/lib/services/order-case-service", () => ({ orderCaseService: state }));
vi.mock("../../apps/web/src/components/support-case-thread", () => ({
  SupportCaseThread: ({ caseId }: { caseId: string }) => (
    <div data-case={caseId}>Existing conversation</div>
  ),
}));

import OrderCaseDetailLoading from "../../apps/web/src/app/admin/commerce/order-cases/[id]/loading";
import OrderCasesLoading from "../../apps/web/src/app/admin/commerce/order-cases/loading";
import {
  OrderCaseCreatePage,
  OrderCaseDetailPage,
  OrderCaseListPage,
  orderCaseMetadata,
} from "../../apps/web/src/components/order-case-page";
import { orderCaseCopy } from "../../apps/web/src/lib/order-case-i18n";

const date = new Date("2026-10-11T00:00:00.000Z");
const evidence = {
  orderId: "ord_a",
  orderNumber: "NEXUS-1",
  orderStatus: "completed",
  totalAmount: 1200,
  currency: "USD",
  itemCount: 1,
  paymentCount: 0,
  recordedCaptureCount: 0,
  recordedMatchingCaptureCount: 0,
  refundedRecordCount: 0,
  disputedRecordCount: 0,
  payments: [],
  capturedAt: date.toISOString(),
  confirmation: "recorded_only",
};
const order = {
  id: "ord_a",
  orderNumber: "NEXUS-1",
  status: "completed",
  totalAmount: 1200,
  currency: "USD",
  createdAt: date,
};
const savedCase = {
  id: "sup_a",
  orderId: "ord_a",
  kind: "refund_request",
  reviewStatus: "refund_recommended",
  revision: 3,
  requestedAmount: 600,
  currency: "USD",
  createdAt: date,
  subject: "<Private order>",
  threadStatus: "open",
  supportUpdatedAt: date,
};
beforeEach(() => {
  state.locale = "en";
  state.actor = { id: "usr_a", role: "user" };
  state.orderDetail.mockReset().mockResolvedValue({ order, evidence, existingCase: null });
  state.detail.mockReset().mockResolvedValue({
    case: savedCase,
    order,
    snapshot: evidence,
    current: evidence,
    evidenceChanged: true,
    evidenceHash: "a".repeat(64),
    history: [
      {
        id: "aud_a",
        reviewStatus: "refund_recommended",
        notes: "<script>Decision</script>",
        createdAt: date,
      },
    ],
    page: 1,
    totalPages: 2,
    canReview: false,
    canRecommendRefund: false,
  });
  state.page.mockReset().mockResolvedValue({
    items: [{ ...savedCase, orderNumber: order.orderNumber }],
    page: 1,
    totalPages: 2,
  });
});
it("does not load private order data without authentication", async () => {
  state.actor = null;
  expect(renderToStaticMarkup(await OrderCaseCreatePage({ orderId: "ord_a" }))).toContain(
    "/auth/login",
  );
  expect(state.orderDetail).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "renders %s snapshots and escaped review history without promising a refund",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await OrderCaseDetailPage({ caseId: "sup_a", query: {} }));
    expect(html).toContain("&lt;Private order&gt;");
    expect(html).toContain("&lt;script&gt;Decision&lt;/script&gt;");
    expect(html).not.toContain("<script>Decision</script>");
    expect(html).toContain(
      locale === "ru" ? "Возврат рекомендован, не выполнен" : "Refund recommended; not executed",
    );
    expect(html).toContain('data-case="sup_a"');
    expect(html).toContain("?page=2");
    expect((await orderCaseMetadata()).robots).toEqual({ index: false, follow: false });
  },
);
it("continues an existing order case instead of displaying a second intake form", async () => {
  state.orderDetail.mockResolvedValue({ order, evidence, existingCase: savedCase });
  const html = renderToStaticMarkup(await OrderCaseCreatePage({ orderId: "ord_a" }));
  expect(html).toContain('href="/workspace/order-cases/sup_a"');
  expect(html).not.toContain("Submit case");
});
it("renders intake and reload controls with shared Button chrome", async () => {
  const html = renderToStaticMarkup(await OrderCaseCreatePage({ orderId: "ord_a" }));
  expect(html).toContain("Reload saved state");
  expect(html).toContain("rounded-lg");
  expect(html).toContain("text-accent");
  expect(html).toContain("underline");
});
it("preserves filters in archive pagination", async () => {
  const html = renderToStaticMarkup(
    await OrderCaseListPage({
      query: { reviewStatus: "refund_recommended", threadStatus: "open" },
    }),
  );
  expect(html).toContain(`<search aria-label="${orderCaseCopy("en").filters}"`);
  expect(html).toContain("reviewStatus=refund_recommended&amp;threadStatus=open&amp;page=2");
  expect(state.page).toHaveBeenCalledWith(
    state.actor,
    false,
    1,
    expect.objectContaining({ threadStatus: "open" }),
  );
});
it.each(["en", "ru"] as const)(
  "names the order-case filter search landmark in %s",
  async (locale) => {
    state.locale = locale;
    const copy = orderCaseCopy(locale);
    const html = renderToStaticMarkup(await OrderCaseListPage({ query: {} }));
    expect(html).toContain(`<search aria-label="${copy.filters}"`);
    expect(html).toContain('name="reviewStatus"');
    expect(html).toContain('name="threadStatus"');
    expect(html).toContain("min-h-11 rounded-lg border border-base bg-surface p-2 text-sm");
    expect(html).toContain("min-h-11");
    expect(html).toContain(copy.apply);
  },
);
it("hides staff controls for self-review and scopes inaccessible case details", async () => {
  const html = renderToStaticMarkup(
    await OrderCaseDetailPage({ caseId: "sup_a", query: {}, staff: true }),
  );
  expect(html).toContain("Another staff member");
  expect(html).not.toContain("Review message");
  state.detail.mockRejectedValue(new AppError("private", 403, "FORBIDDEN"));
  await expect(OrderCaseDetailPage({ caseId: "sup_a", query: {} })).rejects.toThrow("NOT_FOUND");
});
it("shows an honest recovery state when the case queue fails", async () => {
  state.page.mockRejectedValue(new Error("queue unavailable"));
  const copy = orderCaseCopy("en");
  const html = renderToStaticMarkup(
    await OrderCaseListPage({
      staff: true,
      query: { reviewStatus: "refund_recommended", page: "2" },
    }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain(copy.loadUnavailableHint);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-h-11");
  expect(html).toContain("reviewStatus=refund_recommended&amp;page=2");
  expect(html).not.toContain("&lt;Private order&gt;");
});
it("renders an empty queue with clear-filters recovery when filters are active", async () => {
  state.page.mockResolvedValue({ items: [], page: 1, totalPages: 1 });
  const copy = orderCaseCopy("en");
  const html = renderToStaticMarkup(
    await OrderCaseListPage({
      staff: true,
      query: { reviewStatus: "resolved", threadStatus: "open" },
    }),
  );
  expect(html).toContain(copy.empty);
  expect(html).toContain(copy.clear);
  expect(html).toContain('href="/admin/commerce/order-cases"');
  expect(html).toContain("overflow-x-clip");
});
it("shows an honest recovery state when intake evidence fails to load", async () => {
  state.orderDetail.mockRejectedValue(new Error("detail unavailable"));
  const copy = orderCaseCopy("en");
  const html = renderToStaticMarkup(await OrderCaseCreatePage({ orderId: "ord_a" }));
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain(copy.loadUnavailableHint);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("/workspace/purchases/ord_a/support");
});
it("clips honest loading shells on narrow layouts", async () => {
  for (const Loading of [OrderCasesLoading, OrderCaseDetailLoading]) {
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain("min-w-0 max-w-5xl");
    expect(html).toContain("overflow-x-clip");
  }
});
