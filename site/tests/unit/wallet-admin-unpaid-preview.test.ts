import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  listUnpaid: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  buildRepository: {},
  ledgerRepository: {},
  orderOperationsRepository: {
    listEligibleStaleUnpaid: (...args: unknown[]) => state.listUnpaid(...args),
  },
  orderRepository: {},
  organizationRepository: {},
  productRepository: {},
  userRepository: {},
  promoCodeRepository: {},
  walletOrderSettlementRepository: {},
  walletSellerHoldRepository: {},
  walletTopupRepository: {},
  walletWithdrawalRepository: {},
}));

import { WalletPaymentService } from "../../src/lib/services/commerce/wallet-payment-service";

describe("listAdminEligibleStaleUnpaidOrders", () => {
  const previousEngine = process.env.NEXUS_WALLET_ENGINE;

  beforeEach(() => {
    process.env.NEXUS_WALLET_ENGINE = "1";
    state.listUnpaid.mockReset().mockResolvedValue([{ id: "ord_stale" }]);
  });

  afterEach(() => {
    if (previousEngine === undefined) delete process.env.NEXUS_WALLET_ENGINE;
    else process.env.NEXUS_WALLET_ENGINE = previousEngine;
  });

  it("lists eligible unpaid orders when the engine is on", async () => {
    const service = new WalletPaymentService();
    await expect(service.listAdminEligibleStaleUnpaidOrders()).resolves.toEqual([
      { id: "ord_stale" },
    ]);
    expect(state.listUnpaid).toHaveBeenCalledWith(
      expect.objectContaining({ olderThanIso: expect.any(String) }),
    );
  });

  it("refuses the list when the engine is off", async () => {
    delete process.env.NEXUS_WALLET_ENGINE;
    const service = new WalletPaymentService();
    await expect(service.listAdminEligibleStaleUnpaidOrders()).rejects.toMatchObject({
      code: "WALLET_ENGINE_DISABLED",
    });
  });
});
