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
    listEligibleStaleAwaiting: (...args: unknown[]) => state.listTopups(...args),
  },
  walletWithdrawalRepository: {
    listEligibleStaleAwaiting: (...args: unknown[]) => state.listWithdrawals(...args),
  },
}));

import { WalletPaymentService } from "../../src/lib/services/commerce/wallet-payment-service";

describe("listAdminEligibleStaleTopUps / Withdrawals", () => {
  const previousEngine = process.env.NEXUS_WALLET_ENGINE;
  const previousWithdraw = process.env.NEXUS_WALLET_WITHDRAW;

  beforeEach(() => {
    process.env.NEXUS_WALLET_ENGINE = "1";
    process.env.NEXUS_WALLET_WITHDRAW = "1";
    state.listTopups.mockReset().mockResolvedValue([{ id: "top_stale" }]);
    state.listWithdrawals.mockReset().mockResolvedValue([{ id: "wd_stale" }]);
  });

  afterEach(() => {
    if (previousEngine === undefined) delete process.env.NEXUS_WALLET_ENGINE;
    else process.env.NEXUS_WALLET_ENGINE = previousEngine;
    if (previousWithdraw === undefined) delete process.env.NEXUS_WALLET_WITHDRAW;
    else process.env.NEXUS_WALLET_WITHDRAW = previousWithdraw;
  });

  it("lists eligible stale top-ups when the engine is on", async () => {
    const service = new WalletPaymentService();
    await expect(service.listAdminEligibleStaleTopUps()).resolves.toEqual([{ id: "top_stale" }]);
    expect(state.listTopups).toHaveBeenCalledWith(
      expect.objectContaining({ olderThanIso: expect.any(String) }),
    );
  });

  it("refuses stale top-ups when the engine is off", async () => {
    delete process.env.NEXUS_WALLET_ENGINE;
    const service = new WalletPaymentService();
    await expect(service.listAdminEligibleStaleTopUps()).rejects.toMatchObject({
      code: "WALLET_ENGINE_DISABLED",
    });
  });

  it("lists eligible stale withdrawals when withdraw policy is on", async () => {
    const service = new WalletPaymentService();
    await expect(service.listAdminEligibleStaleWithdrawals()).resolves.toEqual([
      { id: "wd_stale" },
    ]);
    expect(state.listWithdrawals).toHaveBeenCalledWith(
      expect.objectContaining({ olderThanIso: expect.any(String) }),
    );
  });

  it("refuses stale withdrawals when withdraw policy is off", async () => {
    delete process.env.NEXUS_WALLET_WITHDRAW;
    const service = new WalletPaymentService();
    await expect(service.listAdminEligibleStaleWithdrawals()).rejects.toMatchObject({
      code: "WALLET_WITHDRAW_DISABLED",
    });
  });
});
