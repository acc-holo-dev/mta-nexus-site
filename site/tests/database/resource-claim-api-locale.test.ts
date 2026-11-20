import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resourceClaimApiCopy } from "../../src/features/resources/resource-claim-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rate: vi.fn(),
  claimFreeResource: vi.fn(),
  getTrustedRequestIp: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("../../src/lib/services/commerce/commerce-service", () => ({
  commerceService: {
    claimFreeResource: mocks.claimFreeResource,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

vi.mock("../../src/features/shell/request-client-ip", () => ({
  getTrustedRequestIp: mocks.getTrustedRequestIp,
}));

import { POST } from "../../src/app/api/resources/claim/route";

function postRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/resources/claim", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("resource claim API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getTrustedRequestIp.mockReturnValue("203.0.113.10");
    mocks.rate.mockResolvedValue({ success: true });
    mocks.getSession.mockResolvedValue({ id: "usr_claim" });
  });

  it("returns bilingual rate-limit and auth errors from nexus_locale", async () => {
    mocks.rate.mockResolvedValueOnce({ success: false });
    const rateRu = await POST(postRequest("ru", { productId: "prd_a" }));
    expect(rateRu.status).toBe(429);
    expect(await rateRu.json()).toMatchObject({ error: resourceClaimApiCopy("ru").rate });

    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await POST(postRequest("en", { productId: "prd_a" }));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: resourceClaimApiCopy("en").authenticationRequired,
    });
    expect(mocks.claimFreeResource).not.toHaveBeenCalled();
  });

  it("returns bilingual invalid claim validation from nexus_locale", async () => {
    const invalid = await POST(postRequest("ru", { productId: "" }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: resourceClaimApiCopy("ru").invalidClaim,
    });
    expect(mocks.claimFreeResource).not.toHaveBeenCalled();
  });
});
