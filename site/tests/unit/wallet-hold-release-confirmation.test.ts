import { describe, expect, it } from "vitest";
import { confirmedWalletHoldRelease } from "../../src/features/commerce/wallet-hold-release-confirmation";

describe("confirmedWalletHoldRelease", () => {
  it("accepts a personal hold release payload", () => {
    expect(
      confirmedWalletHoldRelease({
        accountId: "user:usr_seller",
        organizationId: null,
        released: [{ id: "wsh_1" }, { id: "wsh_2" }],
      }),
    ).toEqual({
      accountId: "user:usr_seller",
      organizationId: null,
      releasedCount: 2,
    });
  });

  it("accepts an organization hold release payload", () => {
    expect(
      confirmedWalletHoldRelease({
        accountId: "org:org_sellers",
        organizationId: "org_sellers",
        released: [{ id: "wsh_3" }],
      }),
    ).toEqual({
      accountId: "org:org_sellers",
      organizationId: "org_sellers",
      releasedCount: 1,
    });
  });

  it("rejects incomplete payloads", () => {
    expect(confirmedWalletHoldRelease(null)).toBeNull();
    expect(confirmedWalletHoldRelease({ accountId: "user:usr_a" })).toBeNull();
    expect(
      confirmedWalletHoldRelease({
        accountId: "user:usr_a",
        organizationId: null,
      }),
    ).toBeNull();
  });
});
