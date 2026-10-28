import type { User } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  claimFreeResource: vi.fn(),
  hasEntitlement: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  entitlementRepository: {
    claimFreeResource: mocks.claimFreeResource,
    hasEntitlement: mocks.hasEntitlement,
  },
}));

vi.mock("@nexus/security", () => ({
  generateId: vi.fn(() => "ent_test"),
}));

import { POST as disabledCheckout } from "../apps/web/src/app/api/checkout/route";
import { CommerceService } from "../apps/web/src/lib/services/commerce-service";

describe("closed-beta commerce behavior", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
  });

  it("fails paid checkout closed with a stable public code", async () => {
    const response = await disabledCheckout(
      new NextRequest("https://nexus.test/api/checkout", {
        method: "POST",
        headers: browserMutationHeaders(),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Paid checkout is not available during the closed beta.",
      code: "CHECKOUT_DISABLED",
    });
  });

  it("claims only through the free entitlement repository path", async () => {
    mocks.claimFreeResource.mockResolvedValue({
      entitlement: {
        id: "ent_test",
        subjectType: "user",
        subjectId: "usr_1",
        resourceId: "prd_1",
        permission: "product.download",
      },
      alreadyClaimed: false,
    });
    const service = new CommerceService();
    const user = {
      id: "usr_1",
      username: "user",
      displayName: "User",
      role: "user",
    } as User;

    await expect(
      service.claimFreeResource({ user, productId: "prd_1", currentToken: "claim-token" }),
    ).resolves.toMatchObject({
      alreadyClaimed: false,
    });
    expect(mocks.claimFreeResource).toHaveBeenCalledWith({
      currentToken: "claim-token",
      entitlementId: "ent_test",
      userId: "usr_1",
      productId: "prd_1",
    });
  });

  it("delegates access checks to the entitlement engine", async () => {
    mocks.hasEntitlement.mockResolvedValue(true);
    const service = new CommerceService();

    await expect(
      service.checkEntitlement({ type: "user", id: "usr_1" }, "prd_1", "product.download"),
    ).resolves.toBe(true);
    expect(mocks.hasEntitlement).toHaveBeenCalledWith(
      { type: "user", id: "usr_1" },
      "prd_1",
      "product.download",
    );
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
