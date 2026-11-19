import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { productBuildsApiCopy } from "../../src/features/resources/product-builds-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rate: vi.fn(),
  assertCanReleaseBuild: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("../../src/lib/services/commerce/product-service", () => ({
  productService: {
    assertCanReleaseBuild: mocks.assertCanReleaseBuild,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

import { POST } from "../../src/app/api/products/[id]/builds/route";

function request(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/products/prd_1/builds", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
      "x-nexus-actor-id": "usr_1",
    },
    body: "{}",
  });
}

describe("product builds API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue(null);
    mocks.rate.mockResolvedValue({ success: true });
    mocks.assertCanReleaseBuild.mockResolvedValue(undefined);
  });

  it("returns bilingual auth and multipart errors from nexus_locale", async () => {
    const unauth = await POST(request("ru"), {
      params: Promise.resolve({ id: "prd_1" }),
    });
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: productBuildsApiCopy("ru").authenticationRequired,
      code: "UNAUTHORIZED",
    });

    mocks.getSession.mockResolvedValueOnce({ id: "usr_1" });
    const multipart = await POST(request("en"), {
      params: Promise.resolve({ id: "prd_1" }),
    });
    expect(multipart.status).toBe(415);
    expect(await multipart.json()).toMatchObject({
      error: productBuildsApiCopy("en").multipartRequired,
      code: "BUILD_MULTIPART_REQUIRED",
    });
  });
});
