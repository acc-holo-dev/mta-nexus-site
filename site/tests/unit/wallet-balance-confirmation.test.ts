import { describe, expect, it } from "vitest";
import { confirmedWalletBalance } from "../../src/features/commerce/wallet-balance-confirmation";

describe("confirmedWalletBalance", () => {
  it("accepts a personal available balance payload", () => {
    expect(
      confirmedWalletBalance({
        accountId: "user:abc",
        organizationId: null,
        currency: "USD",
        available: 1500,
      }),
    ).toEqual({
      accountId: "user:abc",
      organizationId: null,
      currency: "USD",
      available: 1500,
    });
  });

  it("rejects non-integer or negative available", () => {
    expect(
      confirmedWalletBalance({
        accountId: "user:abc",
        organizationId: null,
        currency: "USD",
        available: 12.5,
      }),
    ).toBeNull();
    expect(
      confirmedWalletBalance({
        accountId: "user:abc",
        organizationId: null,
        currency: "USD",
        available: -1,
      }),
    ).toBeNull();
  });
});
