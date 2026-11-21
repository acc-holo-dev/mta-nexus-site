import { describe, expect, it } from "vitest";
import {
  confirmedWalletProviders,
  pickWalletProviderForCapability,
} from "../../src/features/commerce/wallet-provider-selection";

const matrix = {
  withdrawEnabled: false,
  providers: [
    {
      id: "stub",
      capabilities: ["topup", "payout", "webhook_verify", "refund"],
      liveConfigured: false,
    },
    {
      id: "stripe",
      capabilities: ["topup", "payout", "webhook_verify", "refund"],
      liveConfigured: false,
    },
  ],
};

describe("wallet provider selection", () => {
  it("narrows a valid providers payload", () => {
    expect(confirmedWalletProviders(matrix)).toEqual(matrix);
  });

  it("rejects malformed provider rows", () => {
    expect(confirmedWalletProviders({ withdrawEnabled: true, providers: [{ id: "nope" }] })).toBe(
      null,
    );
    expect(confirmedWalletProviders({ providers: [] })).toBe(null);
  });

  it("prefers live-configured providers over stub", () => {
    const live = confirmedWalletProviders({
      withdrawEnabled: true,
      providers: [
        {
          id: "stub",
          capabilities: ["topup", "payout"],
          liveConfigured: false,
        },
        {
          id: "stripe",
          capabilities: ["topup", "payout"],
          liveConfigured: true,
        },
      ],
    });
    expect(live).toEqual(
      expect.objectContaining({
        providers: expect.arrayContaining([expect.objectContaining({ id: "stripe" })]),
      }),
    );
    if (!live) throw new Error("expected confirmed providers");
    expect(pickWalletProviderForCapability(live.providers, "topup")).toBe("stripe");
  });

  it("falls back to stub while live ports stay dark", () => {
    const confirmed = confirmedWalletProviders(matrix);
    expect(confirmed).toEqual(matrix);
    if (!confirmed) throw new Error("expected confirmed providers");
    expect(pickWalletProviderForCapability(confirmed.providers, "topup")).toBe("stub");
    expect(pickWalletProviderForCapability(confirmed.providers, "payout")).toBe("stub");
  });

  it("returns null when no usable provider has the capability", () => {
    expect(
      pickWalletProviderForCapability(
        [{ id: "stripe", capabilities: ["topup"], liveConfigured: false }],
        "payout",
      ),
    ).toBeNull();
  });
});
