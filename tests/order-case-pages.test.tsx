import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@nexus/domain";
const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  detail: vi.fn(),
  page: vi.fn(),
  orderDetail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/order-case-service", () => ({ orderCaseService: state }));
vi.mock("../apps/web/src/components/support-case-thread", () => ({
  SupportCaseThread: ({ caseId }: { caseId: string }) => (
    <div data-case={caseId}>Existing conversation</div>
  ),
}));
import {
  OrderCaseCreatePage,
  OrderCaseDetailPage,
  OrderCaseListPage,
  orderCaseMetadata,
} from "../apps/web/src/components/order-case-page";
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
it("preserves filters in archive pagination", async () => {
  const html = renderToStaticMarkup(
    await OrderCaseListPage({
      query: { reviewStatus: "refund_recommended", threadStatus: "open" },
    }),
  );
  expect(html).toContain("reviewStatus=refund_recommended&amp;threadStatus=open&amp;page=2");
  expect(state.page).toHaveBeenCalledWith(
    state.actor,
    false,
    1,
    expect.objectContaining({ threadStatus: "open" }),
  );
});
it("hides staff controls for self-review and scopes inaccessible case details", async () => {
  const html = renderToStaticMarkup(
    await OrderCaseDetailPage({ caseId: "sup_a", query: {}, staff: true }),
  );
  expect(html).toContain("Another staff member");
  expect(html).not.toContain("Review message");
  state.detail.mockRejectedValue(new AppError("private", 403, "FORBIDDEN"));
  await expect(OrderCaseDetailPage({ caseId: "sup_a", query: {} })).rejects.toThrow("NOT_FOUND");
});
