import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createProduct: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.getSession },
}));

vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { createProduct: mocks.createProduct },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}));

import { POST } from "../apps/web/src/app/api/products/route";

function request(body: unknown) {
  return new NextRequest("http://nexus.test/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("resource creation HTTP errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      id: "usr_creator",
      role: "developer",
    });
    mocks.consumeRateLimit.mockResolvedValue({ success: true });
  });

  it("returns a stable code for invalid resource details before creation", async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "PRODUCT_METADATA_INVALID",
    });
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });

  it("turns a duplicate slug into a safe actionable conflict", async () => {
    mocks.createProduct.mockRejectedValueOnce({
      code: "23505",
      detail: "private database constraint detail",
    });

    const response = await POST(
      request({
        title: "Resource title",
        slug: "resource-title",
        shortDescription: "A short description",
        description: "A longer description for this resource.",
        type: "script",
        price: 0,
        currency: "USD",
        licenseModel: "unlimited",
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "A resource with this slug already exists",
      code: "PRODUCT_SLUG_EXISTS",
    });
  });

  it("does not send internal error details back to the creator", async () => {
    mocks.createProduct.mockRejectedValueOnce(
      new Error("database connection string contains a secret"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await POST(
        request({
          title: "Resource title",
          slug: "resource-title",
          shortDescription: "A short description",
          description: "A longer description for this resource.",
          type: "script",
          price: 0,
          currency: "USD",
          licenseModel: "unlimited",
        }),
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Could not create resource",
        code: "RESOURCE_CREATION_FAILED",
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
