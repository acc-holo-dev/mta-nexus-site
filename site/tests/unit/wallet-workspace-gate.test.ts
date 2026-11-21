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
  WalletPaymentService: class {
    getAvailableBalance = async () => 0;
    listRecentTopUps = async () => [];
    listRecentActivity = async () => [];
    getHeldBalance = async () => 0;
    listHeld = async () => [];
    listManageableOrganizationSellerAccounts = async () => [];
  },
}));

import { WalletWorkspaceScreen } from "../../src/features/commerce/server/wallet-workspace-screen";

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
});
