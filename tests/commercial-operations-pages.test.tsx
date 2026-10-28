import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppError } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "admin" } as null | { id: string; role: "admin" | "moderator" },
  locale: "en" as "en" | "ru",
  catalog: vi.fn(),
  adminDetail: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...rest }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/commercial-plan-service", () => ({
  commercialPlanService: { catalog: state.catalog, adminDetail: state.adminDetail },
  orderOperationsService: { detail: state.detail },
}));
import Catalog from "../apps/web/src/app/subscriptions/page";
import Admin from "../apps/web/src/app/admin/commerce/plans/[id]/page";
import Operations, { metadata } from "../apps/web/src/app/workspace/purchases/[id]/operations/page";
import { LocaleProvider } from "../apps/web/src/components/locale-context";
const now = new Date("2026-10-10T12:00:00Z"),
  input = {
    params: Promise.resolve({ id: "ord_a" }),
    searchParams: Promise.resolve({ page: "2" }),
  };
const terms = {
  titleRu: "Тариф продавца",
  titleEn: "Seller plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Published plan terms",
  price: 999,
  currency: "USD",
  durationDays: 30,
  commissionBps: 750,
};
const markup = (node: ReactNode) =>
  renderToStaticMarkup(<LocaleProvider locale={state.locale}>{node}</LocaleProvider>);
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "admin" };
  state.locale = "en";
  state.catalog.mockReset().mockResolvedValue({
    plans: [
      {
        ...terms,
        id: "cplan_a",
        slug: "seller-plan",
        scope: "organization",
        status: "published",
        revision: 2,
        secret: "PRIVATE",
      },
    ],
    total: 21,
    totalPages: 2,
    page: 2,
  });
  state.adminDetail.mockReset().mockResolvedValue({
    plan: {
      ...terms,
      id: "cplan_a",
      slug: "seller-plan",
      scope: "user",
      status: "published",
      revision: 2,
      actorId: "PRIVATE-ADMIN",
      updatedAt: now,
    },
    history: [
      {
        revision: 2,
        status: "published",
        reason: "<script>Reviewed</script>",
        terms,
        createdAt: now,
        actorId: "PRIVATE-ADMIN",
      },
    ],
    total: 21,
    page: 2,
    totalPages: 2,
  });
  state.detail.mockReset().mockResolvedValue({
    order: { id: "ord_a", orderNumber: "N-1", status: "pending", updatedAt: now },
    attempts: [
      {
        id: "pay_a",
        status: "unrecognized-private-state",
        amount: 999,
        currency: "USD",
        createdAt: now,
        updatedAt: now,
        providerTransactionId: "PRIVATE-TX",
        failureReason: "PRIVATE-FAILURE",
      },
    ],
    canCancel: false,
    total: 21,
    totalPages: 2,
    page: 2,
  });
});
it.each(["en", "ru"] as const)(
  "renders published %s terms and explicitly unavailable activation",
  async (locale) => {
    state.locale = locale;
    state.user = null;
    const html = markup(
      await Catalog({ searchParams: Promise.resolve({ scope: "organization", page: "2" }) }),
    );
    expect(state.catalog).toHaveBeenCalledWith("organization", 2);
    expect(html).toContain(locale === "ru" ? terms.titleRu : terms.titleEn);
    expect(html).toContain(locale === "ru" ? "Активация недоступна" : "Activation unavailable");
    expect(html).toContain("disabled");
    expect(html).toContain("scope=organization&amp;page=1");
    expect(html).not.toContain("PRIVATE");
  },
);
it("preserves immutable draft editor semantics and escapes historical reasons", async () => {
  const html = markup(await Admin({ ...input, params: Promise.resolve({ id: "cplan_a" }) }));
  expect(state.adminDetail).toHaveBeenCalledWith(state.user, "cplan_a", 2);
  expect(html).toContain("&lt;script&gt;Reviewed&lt;/script&gt;");
  expect(html).toContain("immutable version");
  expect(html).not.toContain("PRIVATE-");
});
it("masks unknown attempt states, keeps private metadata out, and blocks cancellation after an attempt", async () => {
  const html = markup(await Operations(input));
  expect(html).toContain("Unknown state");
  expect(html).toContain("provider reconciliation");
  expect(html).not.toContain("PRIVATE-");
  expect(html).not.toContain("unrecognized-private-state");
  expect(html).not.toContain("<textarea");
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
it("provides reason and confirmation controls only for a currently cancellable unpaid order", async () => {
  state.detail.mockResolvedValue({
    order: { id: "ord_a", orderNumber: "N-1", status: "pending", updatedAt: now },
    attempts: [],
    canCancel: true,
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const html = markup(await Operations(input));
  expect(html).toContain("<textarea");
  expect(html).toContain('type="checkbox"');
  expect(html).toContain("Cancel unpaid order");
  expect(html).toContain("No recorded payment attempts");
});
it("does not load private order or admin history before login", async () => {
  state.user = null;
  expect(markup(await Operations(input))).toContain("/auth/login");
  await expect(Admin(input)).rejects.toThrow("NEXT_NOT_FOUND");
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.adminDetail).not.toHaveBeenCalled();
});
it("hides another buyer's order", async () => {
  state.detail.mockRejectedValue(new AppError("Private order", 404, "NOT_FOUND"));
  await expect(Operations(input)).rejects.toThrow("NEXT_NOT_FOUND");
});
