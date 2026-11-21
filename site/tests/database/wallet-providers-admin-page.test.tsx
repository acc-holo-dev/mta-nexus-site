vi.mock("server-only", () => ({}));

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";

const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "admin" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  engine: false,
  withdraw: false,
  matrix: [
    {
      id: "stub" as const,
      capabilities: ["topup", "payout", "webhook_verify", "refund"] as const,
      liveConfigured: false,
    },
    {
      id: "stripe" as const,
      capabilities: ["topup", "payout", "webhook_verify", "refund"] as const,
      liveConfigured: false,
    },
    {
      id: "yookassa" as const,
      capabilities: ["topup", "payout", "webhook_verify", "refund"] as const,
      liveConfigured: false,
    },
    {
      id: "crypto" as const,
      capabilities: ["topup", "payout", "webhook_verify", "refund"] as const,
      liveConfigured: false,
    },
  ],
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/commerce/wallet-providers",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../../src/features/shell/locale", () => ({
  useNexusLocale: () => ({ locale: state.locale }),
}));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  isWalletWithdrawEnabled: () => state.withdraw,
  WalletPaymentService: class {
    capabilityMatrix = () => state.matrix;
    previewAdminBatchEligible = async () => ({
      holds: 2,
      topups: 1,
      unpaidOrders: 0,
      withdrawals: state.withdraw ? 3 : null,
    });
    listAdminRecentTopUps = async () => [
      {
        id: "top_a",
        accountId: "user:usr_b",
        amount: 500,
        currency: "USD",
        providerId: "stub",
        status: "awaiting_provider",
        idempotencyKey: "idem_a",
        providerSessionId: "sess_a",
        createdAt: "2026-11-21T12:00:00.000Z",
      },
    ];
    listAdminRecentWithdrawals = async () =>
      state.withdraw
        ? [
            {
              id: "wd_a",
              accountId: "org:org_a",
              amount: 200,
              currency: "EUR",
              providerId: "stub",
              status: "awaiting_provider",
              idempotencyKey: "idem_w",
              providerSessionId: "sess_w",
              escrowAccountId: "escrow:wd_a",
              createdAt: "2026-11-21T12:05:00.000Z",
            },
          ]
        : [];
  },
}));

import Loading from "../../src/app/admin/commerce/wallet-providers/loading";
import Page, { generateMetadata } from "../../src/app/admin/commerce/wallet-providers/page";

beforeEach(() => {
  state.user = { id: "usr_a", role: "admin" };
  state.locale = "en";
  state.engine = false;
  state.withdraw = false;
});

it("authenticates admins and lists the dark provider matrix", async () => {
  const copy = getWalletCopy("en");
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain(copy.providersAdminTitle);
  expect(html).toContain(copy.providersAdminNote);
  expect(html).toContain("stub");
  expect(html).toContain("stripe");
  expect(html).toContain("yookassa");
  expect(html).toContain("crypto");
  expect(html).toContain(copy.providersAdminLiveNo);
  expect(html).toContain(copy.providersAdminOff);
  expect(html).toContain(copy.providersAdminOpsEngineOff);
  expect(html).not.toContain(copy.providersAdminHoldSubmit);
  expect(html).toContain('href="/admin"');
  expect((await generateMetadata()).robots).toMatchObject({ index: false, follow: false });
});

it("shows engine ops CTAs when the wallet engine is on", async () => {
  state.engine = true;
  state.withdraw = false;
  const copy = getWalletCopy("en");
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain(copy.providersAdminOn);
  expect(html).toContain(copy.providersAdminOpsNote);
  expect(html).toContain(copy.providersAdminHoldSubmit);
  expect(html).toContain(copy.providersAdminTopupExpireSubmit);
  expect(html).toContain(copy.providersAdminOrderExpireSubmit);
  expect(html).toContain(copy.providersAdminEligible.replace("{count}", "2"));
  expect(html).toContain(copy.providersAdminEligible.replace("{count}", "1"));
  expect(html).toContain(copy.providersAdminEligible.replace("{count}", "0"));
  expect(html).toContain(copy.providersAdminIntentsTitle);
  expect(html).toContain(copy.providersAdminIntentsNote);
  expect(html).toContain("user:usr_b");
  expect(html).toContain("top_a");
  expect(html).toContain(copy.providersAdminWithdrawExpireDisabled);
  expect(html).not.toContain(copy.providersAdminWithdrawExpireSubmit);
  expect(html).not.toContain(copy.providersAdminEligible.replace("{count}", "3"));
  expect(html).not.toContain("wd_a");
});

it("shows withdrawal expiry when withdraw policy is on", async () => {
  state.engine = true;
  state.withdraw = true;
  const copy = getWalletCopy("en");
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain(copy.providersAdminWithdrawExpireSubmit);
  expect(html).toContain(copy.providersAdminEligible.replace("{count}", "3"));
  expect(html).toContain("wd_a");
  expect(html).toContain("org:org_a");
  expect(html).not.toContain(copy.providersAdminWithdrawExpireDisabled);
  expect(html).not.toContain(copy.providersAdminOpsEngineOff);
});

it("refuses the matrix for non-admins", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
});

it("sends guests to sign-in", async () => {
  state.user = null;
  expect(renderToStaticMarkup(await Page())).toContain("/auth/login");
});

it("clips honest loading shell copy", async () => {
  const copy = getWalletCopy("en");
  const html = renderToStaticMarkup(await Loading());
  expect(html).toContain(copy.providersAdminTitle);
  expect(html).toContain(copy.providersAdminLoading);
  expect(html).toMatch(/(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
});
