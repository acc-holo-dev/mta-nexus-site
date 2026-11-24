import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  listTopups: vi.fn(),
  listWithdrawals: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  buildRepository: {},
  ledgerRepository: {},
  orderOperationsRepository: {},
  orderRepository: {},
  organizationRepository: {},
  productRepository: {},
  userRepository: {},
  promoCodeRepository: {},
  walletFxRateRepository: {},
  walletOrderSettlementRepository: {},
  walletSellerHoldRepository: {},
  walletTopupRepository: {
    listRecentAcrossAccounts: (...args: unknown[]) => state.listTopups(...args),
  },
  walletWithdrawalRepository: {
    listRecentAcrossAccounts: (...args: unknown[]) => state.listWithdrawals(...args),
  },
}));

import { WalletPaymentService } from "../../src/lib/services/commerce/wallet-payment-service";

describe("admin recent intent lists", () => {
  const previousEngine = process.env.NEXUS_WALLET_ENGINE;
  const previousWithdraw = process.env.NEXUS_WALLET_WITHDRAW;

  beforeEach(() => {
    process.env.NEXUS_WALLET_ENGINE = "1";
    process.env.NEXUS_WALLET_WITHDRAW = "1";
    state.listTopups.mockReset().mockResolvedValue([{ id: "top_a" }]);
    state.listWithdrawals.mockReset().mockResolvedValue([{ id: "wd_a" }]);
  });

  afterEach(() => {
    if (previousEngine === undefined) delete process.env.NEXUS_WALLET_ENGINE;
    else process.env.NEXUS_WALLET_ENGINE = previousEngine;
    if (previousWithdraw === undefined) delete process.env.NEXUS_WALLET_WITHDRAW;
    else process.env.NEXUS_WALLET_WITHDRAW = previousWithdraw;
  });

  it("lists recent top-ups when the engine is on", async () => {
    const service = new WalletPaymentService();
    await expect(service.listAdminRecentTopUps()).resolves.toEqual([{ id: "top_a" }]);
    expect(state.listTopups).toHaveBeenCalledWith(20);
  });

  it("lists recent withdrawals when withdraw policy is on", async () => {
    const service = new WalletPaymentService();
    await expect(service.listAdminRecentWithdrawals()).resolves.toEqual([{ id: "wd_a" }]);
    expect(state.listWithdrawals).toHaveBeenCalledWith(20);
  });

  it("refuses top-up list when the engine is off", async () => {
    delete process.env.NEXUS_WALLET_ENGINE;
    const service = new WalletPaymentService();
    await expect(service.listAdminRecentTopUps()).rejects.toMatchObject({
      code: "WALLET_ENGINE_DISABLED",
    });
  });

  it("refuses withdrawal list when withdraw policy is off", async () => {
    process.env.NEXUS_WALLET_WITHDRAW = "0";
    const service = new WalletPaymentService();
    await expect(service.listAdminRecentWithdrawals()).rejects.toMatchObject({
      code: "WALLET_WITHDRAW_DISABLED",
    });
  });
});
