import { describe, expect, it } from "vitest";
import { release2027Profile } from "../../src/lib/platform/release-2027";

describe("2027 release profile", () => {
  it("keeps card checkout off and wallet dark by default", () => {
    expect(release2027Profile({})).toMatchObject({
      id: "2027-single-instance",
      settlementCurrency: "RUB",
      displayCurrencies: ["RUB", "USD", "EUR"],
      cardCheckout: "disabled",
      siteWallet: "off",
      staffQueues: "paginated",
    });
  });

  it("reports engine and withdraw only from explicit flags", () => {
    expect(release2027Profile({ NEXUS_WALLET_ENGINE: "1" }).siteWallet).toBe("engine");
    expect(
      release2027Profile({ NEXUS_WALLET_ENGINE: "1", NEXUS_WALLET_WITHDRAW: "1" }).siteWallet,
    ).toBe("engine_and_withdraw");
    expect(release2027Profile({ NEXUS_WALLET_WITHDRAW: "1" }).siteWallet).toBe("off");
  });
});
