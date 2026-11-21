import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  engine: false,
  session: null as null | { id: string },
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
    getAvailableBalance = async () => 0;
    listRecentTopUps = async () => [];
    listRecentActivity = async () => [];
    getHeldBalance = async () => 0;
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
});
