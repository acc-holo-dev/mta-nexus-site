import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { productsApiCopy } from "../../src/features/resources/products-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rate: vi.fn(),
  listPublicPage: vi.fn(),
  createProduct: vi.fn(),
  findCreatedDraftForReplay: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("../../src/lib/services/commerce/product-service", () => ({
  productService: {
    listPublicPage: mocks.listPublicPage,
    createProduct: mocks.createProduct,
    findCreatedDraftForReplay: mocks.findCreatedDraftForReplay,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

import { GET, POST } from "../../src/app/api/products/route";

function getRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/products", {
    headers: { cookie: `nexus_locale=${locale}` },
  });
}

function postRequest(locale: "en" | "ru", body: Record<string, unknown>, actorId?: string) {
  const headers: Record<string, string> = {
    ...browserMutationHeaders(),
    cookie: `nexus_session=tok;nexus_locale=${locale}`,
    "content-type": "application/json",
  };
  if (actorId) headers["x-nexus-actor-id"] = actorId;
  return new NextRequest("https://nexus.test/api/products", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("products API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_prod" });
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual GET catalog unavailable from nexus_locale", async () => {
    mocks.listPublicPage.mockRejectedValueOnce(new Error("db"));
    const ru = await GET(getRequest("ru"));
    expect(ru.status).toBe(503);
    expect(await ru.json()).toMatchObject({
      error: productsApiCopy("ru").catalogUnavailable,
    });
  });

  it("returns bilingual POST auth and paid-disabled from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await POST(postRequest("ru", { title: "x" }, "usr_prod"));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      code: "UNAUTHORIZED",
      error: productsApiCopy("ru").authenticationRequired,
    });

    const paid = await POST(
      postRequest(
        "en",
        {
          title: "Paid",
          slug: "paid-resource",
          shortDescription: "Short description here",
          description: "A longer description for this paid resource.",
          type: "script",
          price: 10,
          currency: "USD",
          licenseModel: "unlimited",
        },
        "usr_prod",
      ),
    );
    expect(paid.status).toBe(422);
    expect(await paid.json()).toMatchObject({
      code: "PAID_RESOURCES_DISABLED",
      error: productsApiCopy("en").paidDisabled,
    });
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });
});
