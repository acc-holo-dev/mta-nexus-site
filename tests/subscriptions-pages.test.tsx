import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  dashboard: vi.fn(),
  scopes: vi.fn(),
  history: vi.fn(),
  detail: vi.fn(),
  plan: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/subscriptions-service", () => ({
  subscriptionsService: {
    dashboard: state.dashboard,
    scopes: state.scopes,
    history: state.history,
    detail: state.detail,
    plan: state.plan,
  },
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: state.locale }),
}));

import Activate from "../apps/web/src/app/workspace/subscriptions/activate/page";
import History from "../apps/web/src/app/workspace/subscriptions/history/page";
import Account from "../apps/web/src/app/workspace/subscriptions/page";
import Detail from "../apps/web/src/app/workspace/subscriptions/receipts/[id]/page";
import { subscriptionsCopy } from "../apps/web/src/lib/subscriptions-i18n";
import { activation, date, expiresAt, plan, receipt, subscription } from "./subscriptions-fixtures";

const context = { params: Promise.resolve({ id: receipt.id }), searchParams: Promise.resolve({}) },
  activateContext = {
    ...context,
    searchParams: Promise.resolve({ planId: activation.planId, revision: "2" }),
  };
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.dashboard.mockResolvedValue({
    scope: { id: "user:usr_a", name: null },
    subscription,
    commissionBps: 750,
    initialHoldDays: 7,
    observedAt: date,
  });
  state.scopes.mockResolvedValue({
    scopes: [{ id: "org_a", name: "Org" }],
    page: 1,
    totalPages: 2,
  });
  state.plan.mockResolvedValue(plan);
  state.detail.mockResolvedValue({
    receipt,
    current: { ...subscription, status: "expired" },
    observedAt: expiresAt,
  });
  state.history.mockResolvedValue({
    scope: { id: "user:usr_a", name: null },
    receipts: [
      {
        id: receipt.id,
        action: "activate",
        createdAt: date,
        titleRu: plan.titleRu,
        titleEn: plan.titleEn,
        planRevision: 2,
      },
    ],
    page: 2,
    totalPages: 3,
    total: 41,
  });
});
it("does not read subscription data before sign-in", async () => {
  state.actor = null;
  for (const Page of [Account, Activate, History, Detail])
    expect(renderToStaticMarkup(await Page(context))).toContain("/auth/login");
  expect(state.dashboard).not.toHaveBeenCalled();
  expect(state.plan).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
});
it.each(["ru", "en"] as const)(
  "renders active personal state and explicit cancellation in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Account(context)),
      c = subscriptionsCopy(locale);
    expect(html).toContain(c.title);
    expect(html).toContain(c.statuses.active);
    expect(html).toContain(c.confirmCancel);
    expect(html).toContain(c.feeNote.replaceAll("'", "&#x27;"));
    expect(html).toContain("7.5%");
    expect(html).toContain(c.noRenewal);
  },
);
it("offers activation only for a current free plan", async () => {
  const html = renderToStaticMarkup(await Activate(activateContext));
  expect(html).toContain(subscriptionsCopy("en").activate);
  expect(html).toContain(subscriptionsCopy("en").notice);
  expect(state.scopes).not.toHaveBeenCalled();
  state.plan.mockResolvedValue({ ...plan, price: 100 });
  expect(renderToStaticMarkup(await Activate(activateContext))).toContain(
    subscriptionsCopy("en").paymentRequired,
  );
});
it("supports organization selection and bounded scope pagination", async () => {
  state.plan.mockResolvedValue({ ...plan, scope: "organization" });
  const html = renderToStaticMarkup(await Activate(activateContext));
  expect(html).toContain("org_a");
  expect(html).toContain("scopePage=2");
  expect(state.scopes).toHaveBeenCalledWith(state.actor, 1);
});
it("shows expiry without an active cancellation button", async () => {
  state.dashboard.mockResolvedValue({
    scope: { id: "user:usr_a", name: null },
    subscription: { ...subscription, status: "expired" },
    commissionBps: 1000,
    initialHoldDays: 7,
  });
  const html = renderToStaticMarkup(await Account(context));
  expect(html).toContain(subscriptionsCopy("en").expiredNote);
  expect(html).toContain("10%");
  expect(html).not.toContain(subscriptionsCopy("en").confirmCancel);
});
it("preserves frozen receipt terms alongside separate current state and JSON export", async () => {
  const html = renderToStaticMarkup(await Detail(context));
  expect(html).toContain("Free plan activated");
  expect(html).toContain("Expired");
  expect(html).toContain("Free plan");
  expect(html).toContain(`/api/subscriptions/account/receipts/${receipt.id}/export`);
});
it("filters history while keeping account scope in navigation", async () => {
  const html = renderToStaticMarkup(
    await History({
      ...context,
      searchParams: Promise.resolve({ organizationId: "org_a", days: "30", page: "2" }),
    }),
  );
  expect(state.history).toHaveBeenCalledWith(
    state.actor,
    expect.objectContaining({ organizationId: "org_a", days: 30, page: 2 }),
  );
  expect(html).toContain("page=1&amp;days=30&amp;organizationId=org_a");
  expect(html).toContain("page=3&amp;days=30&amp;organizationId=org_a");
});
it("masks lost financial authority and rejects stale selections", async () => {
  state.dashboard.mockRejectedValue(new AppError("Private", 404, "NOT_FOUND"));
  await expect(Account(context)).rejects.toThrow("NOT_FOUND");
  state.plan.mockResolvedValue({ ...plan, revision: 3 });
  const html = renderToStaticMarkup(await Activate(activateContext));
  expect(html).toContain(subscriptionsCopy("en").changed);
});
it("escapes plan descriptions and rejects ambiguous selectors before data access", async () => {
  state.detail.mockResolvedValue({
    receipt: {
      ...receipt,
      subscription: {
        ...subscription,
        terms: {
          ...plan,
          titleEn: "<script>Plan</script>",
          descriptionEn: "<img src=x onerror=bad>",
        },
      },
    },
    current: subscription,
    observedAt: date,
  });
  const html = renderToStaticMarkup(await Detail(context));
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;script&gt;");
  const invalid = renderToStaticMarkup(
    await Activate({
      ...context,
      searchParams: Promise.resolve({ planId: ["a", "b"], revision: "2" }),
    }),
  );
  expect(invalid).toContain('role="alert"');
  expect(state.plan).not.toHaveBeenCalled();
});
