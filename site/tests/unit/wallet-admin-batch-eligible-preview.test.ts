import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  countHolds: vi.fn(),
  countTopups: vi.fn(),
  countWithdrawals: vi.fn(),
  countOrders: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  buildRepository: {},
  ledgerRepository: {},
  orderOperationsRepository: {
    countEligibleStaleUnpaid: (...args: unknown[]) => state.countOrders(...args),
  },
  orderRepository: {},
  organizationRepository: {},
  productRepository: {},
  userRepository: {},
  promoCodeRepository: {},
  walletOrderSettlementRepository: {},
  walletSellerHoldRepository: {
    countEligibleMatured: (...args: unknown[]) => state.countHolds(...args),
  },
  walletTopupRepository: {
    countEligibleStaleAwaiting: (...args: unknown[]) => state.countTopups(...args),
  },
  walletWithdrawalRepository: {
    countEligibleStaleAwaiting: (...args: unknown[]) => state.countWithdrawals(...args),
  },
}));

import { WalletPaymentService } from "../../src/lib/services/commerce/wallet-payment-service";

describe("previewAdminBatchEligible", () => {
  const previousEngine = process.env.NEXUS_WALLET_ENGINE;
  const previousWithdraw = process.env.NEXUS_WALLET_WITHDRAW;

  beforeEach(() => {
    process.env.NEXUS_WALLET_ENGINE = "1";
    process.env.NEXUS_WALLET_WITHDRAW = "1";
    state.countHolds.mockReset().mockResolvedValue(2);
    state.countTopups.mockReset().mockResolvedValue(1);
    state.countWithdrawals.mockReset().mockResolvedValue(3);
    state.countOrders.mockReset().mockResolvedValue(0);
  });

  afterEach(() => {
    if (previousEngine === undefined) delete process.env.NEXUS_WALLET_ENGINE;
    else process.env.NEXUS_WALLET_ENGINE = previousEngine;
    if (previousWithdraw === undefined) delete process.env.NEXUS_WALLET_WITHDRAW;
    else process.env.NEXUS_WALLET_WITHDRAW = previousWithdraw;
  });

  it("aggregates read-only eligible counts when the engine is on", async () => {
    const service = new WalletPaymentService();
    await expect(
      service.previewAdminBatchEligible({ nowIso: "2026-11-21T12:00:00.000Z" }),
    ).resolves.toEqual({
      holds: 2,
      topups: 1,
      unpaidOrders: 0,
      withdrawals: 3,
    });
    expect(state.countHolds).toHaveBeenCalled();
    expect(state.countTopups).toHaveBeenCalled();
    expect(state.countOrders).toHaveBeenCalled();
    expect(state.countWithdrawals).toHaveBeenCalled();
  });

  it("omits withdrawal counts when withdraw policy is off", async () => {
    process.env.NEXUS_WALLET_WITHDRAW = "0";
    const service = new WalletPaymentService();
    await expect(service.previewAdminBatchEligible()).resolves.toMatchObject({
      withdrawals: null,
    });
    expect(state.countWithdrawals).not.toHaveBeenCalled();
  });

  it("refuses preview when the wallet engine is off", async () => {
    delete process.env.NEXUS_WALLET_ENGINE;
    const service = new WalletPaymentService();
    await expect(service.previewAdminBatchEligible()).rejects.toMatchObject({
      code: "WALLET_ENGINE_DISABLED",
    });
  });
});
