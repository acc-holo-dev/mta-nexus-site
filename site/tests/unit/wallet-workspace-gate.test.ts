import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  engine: false,
  session: null as null | { id: string },
  available: {} as Record<string, number>,
  held: {} as Record<string, number>,
  fail: new Set<string>(),
  activity: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session" }) }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => "en",
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.session },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  isWalletWithdrawEnabled: () => false,
  WalletPaymentService: class {
    getAvailableBalance = async (_accountId: string, currency: string) => {
      if (state.fail.has(currency)) throw new Error("ledger read failed");
      return state.available[currency] ?? 0;
    };
    listRecentTopUps = async () => [];
    listRecentActivity = async () => state.activity;
    getHeldBalance = async (_accountId: string, currency: string) => state.held[currency] ?? 0;
    listHeld = async () => [];
    listManageableOrganizationSellerAccounts = async () => [
      { organizationId: "org_a", accountId: "org:org_a" },
    ];
    listRecentWithdrawals = async () => [];
  },
}));

vi.mock("../../src/features/shell/locale", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../../src/features/commerce/wallet-topup", () => ({
  WalletTopUpForm: () => null,
  WalletTopUpCancelForm: () => null,
  WalletTopUpStubCreditForm: () => null,
}));
vi.mock("../../src/features/commerce/wallet-hold-release", () => ({
  WalletHoldReleaseForm: () => null,
}));
vi.mock("../../src/features/commerce/wallet-withdraw", () => ({
  WalletWithdrawForm: () => null,
  WalletWithdrawalCancelForm: () => null,
  WalletWithdrawalStubSettleForm: () => null,
}));

import { renderToStaticMarkup } from "react-dom/server";
import { WalletWorkspaceScreen } from "../../src/features/commerce/server/wallet-workspace-screen";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";

describe("wallet workspace gate", () => {
  beforeEach(() => {
    state.engine = false;
    state.session = { id: "usr_wallet" };
    state.available = {};
    state.held = {};
    state.fail = new Set();
    state.activity = [];
  });

  it("hides the workspace wallet when the engine flag is off", async () => {
    await expect(
      WalletWorkspaceScreen({ searchParams: Promise.resolve({ currency: "EUR" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders org held empty as EmptyState, not unavailable copy", async () => {
    state.engine = true;
    const copy = getWalletCopy("en");
    const html = renderToStaticMarkup(
      await WalletWorkspaceScreen({ searchParams: Promise.resolve({ currency: "USD" }) }),
    );
    expect(html).toContain(copy.heldOrgEmpty);
    expect(html).toContain(copy.heldOrgEmptyHint);
    expect(html).not.toContain(copy.heldUnavailable);
  });

  it("shows every currency and opens the one that holds money", async () => {
    state.engine = true;
    state.available = { USD: 0, EUR: 0, RUB: 5000 };
    state.held = { RUB: 100 };
    state.activity = [
      {
        id: "ldg_grant",
        amount: 5000,
        currency: "RUB",
        referenceType: "staff_grant",
        referenceId: "grant_1",
        createdAt: "2026-11-24T00:00:00.000Z",
      },
    ];
    const copy = getWalletCopy("en");
    const html = renderToStaticMarkup(
      await WalletWorkspaceScreen({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain(copy.balances);
    expect(html).toContain("50.00 RUB");
    expect(html).toContain("0.00 USD");
    expect(html).toContain("0.00 EUR");
    expect(html).toContain("1.00 RUB");
    expect(html).toContain(copy.activityStaffGrant);
    expect(html).toMatch(/currency=RUB"[^>]*aria-current="page"/);
    expect(html).not.toMatch(/currency=EUR"[^>]*aria-current="page"/);
  });

  it("keeps a failed currency unknown while the selected balance stays visible", async () => {
    state.engine = true;
    state.available = { USD: 1500, EUR: 0 };
    state.fail = new Set(["RUB"]);
    const copy = getWalletCopy("en");
    const html = renderToStaticMarkup(
      await WalletWorkspaceScreen({ searchParams: Promise.resolve({ currency: "USD" }) }),
    );
    expect(html).toContain("15.00 USD");
    expect(html).toContain(copy.balanceUnavailable);
    expect(html).not.toContain(copy.loadUnavailable);
  });
});
