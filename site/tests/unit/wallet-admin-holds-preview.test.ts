import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  listHolds: vi.fn(),
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
  walletSellerHoldRepository: {
    listEligibleMatured: (...args: unknown[]) => state.listHolds(...args),
  },
  walletTopupRepository: {},
  walletWithdrawalRepository: {},
}));

import { WalletPaymentService } from "../../src/lib/services/commerce/wallet-payment-service";

describe("listAdminEligibleMaturedHolds", () => {
  const previousEngine = process.env.NEXUS_WALLET_ENGINE;

  beforeEach(() => {
    process.env.NEXUS_WALLET_ENGINE = "1";
    state.listHolds.mockReset().mockResolvedValue([{ id: "hold_a" }]);
  });

  afterEach(() => {
    if (previousEngine === undefined) delete process.env.NEXUS_WALLET_ENGINE;
    else process.env.NEXUS_WALLET_ENGINE = previousEngine;
  });

  it("lists eligible matured holds when the engine is on", async () => {
    const service = new WalletPaymentService();
    await expect(service.listAdminEligibleMaturedHolds()).resolves.toEqual([{ id: "hold_a" }]);
    expect(state.listHolds).toHaveBeenCalledWith({});
  });

  it("refuses the list when the engine is off", async () => {
    delete process.env.NEXUS_WALLET_ENGINE;
    const service = new WalletPaymentService();
    await expect(service.listAdminEligibleMaturedHolds()).rejects.toMatchObject({
      code: "WALLET_ENGINE_DISABLED",
    });
  });
});
