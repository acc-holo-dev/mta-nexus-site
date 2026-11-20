import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { productsApiCopy } from "../../src/features/resources/products-api-copy";

const mocks = vi.hoisted(() => ({
  getProductById: vi.fn(),
}));

vi.mock("../../src/lib/services/commerce/product-service", () => ({
  productService: {
    getProductById: mocks.getProductById,
  },
}));

import { GET } from "../../src/app/api/products/[id]/route";

const params = Promise.resolve({ id: "prd_1" });

function getRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/products/prd_1", {
    headers: { cookie: `nexus_locale=${locale}` },
  });
}

describe("products detail API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bilingual not-found from nexus_locale", async () => {
    mocks.getProductById.mockResolvedValueOnce(null);
    const missing = await GET(getRequest("ru"), { params });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      error: productsApiCopy("ru").notFound,
    });
  });

  it("returns bilingual details-unavailable from nexus_locale", async () => {
    mocks.getProductById.mockRejectedValueOnce(new Error("db"));
    const unavailable = await GET(getRequest("en"), { params });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      error: productsApiCopy("en").detailsUnavailable,
    });
  });
});
