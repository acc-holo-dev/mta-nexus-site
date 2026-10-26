import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createProduct: vi.fn(),
  getProductPreviewBySlug: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.getSession },
}));

vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    createProduct: mocks.createProduct,
    getProductPreviewBySlug: mocks.getProductPreviewBySlug,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}));

import { POST } from "../apps/web/src/app/api/products/route";

const validResourceInput = {
  title: "Resource title",
  slug: "resource-title",
  shortDescription: "A short description",
  description: "A longer description for this resource.",
  type: "script",
  price: 0,
  currency: "USD",
  licenseModel: "unlimited",
  tags: [],
  compatibility: { dependencies: [] },
};

function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("X-Request-Id")).toMatch(
    /^[0-9a-f-]{20,}$/u,
  );
}

function request(body: unknown) {
  return new NextRequest("http://nexus.test/api/products", {
    method: "POST",
    headers: { ...browserMutationHeaders(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("resource creation HTTP errors", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      id: "usr_creator",
      role: "developer",
    });
    mocks.consumeRateLimit.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a stable code for invalid resource details before creation", async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({
      code: "PRODUCT_METADATA_INVALID",
    });
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });

  it("turns a duplicate slug into a safe actionable conflict", async () => {
    mocks.createProduct.mockRejectedValueOnce({
      code: "23505",
      constraint_name: "products_slug_unique",
      detail: "private database constraint detail",
    });
    mocks.getProductPreviewBySlug.mockResolvedValueOnce({
      id: "prd_other_author",
      slug: "resource-title",
      authorId: "usr_other",
      status: "draft",
    });

    const response = await POST(request(validResourceInput));

    expect(response.status).toBe(409);
    expectPrivate(response);
    expect(await response.json()).toEqual({
      error: "A resource with this slug already exists",
      code: "PRODUCT_SLUG_EXISTS",
    });
  });

  it.each([
    { code: "23505", constraint_name: "products_slug_unique" },
    { cause: { code: "23505", constraint_name: "products_slug_unique" } },
    { cause: { cause: { code: "23505", constraint_name: "products_slug_idx" } } },
  ])("recovers the creator's draft from a direct or wrapped slug conflict %#", async (error) => {
    const existingDraft = {
      id: "prd_existing_draft",
      slug: "resource-title",
      title: "Resource title",
      shortDescription: "A short description",
      description: "A longer description for this resource.",
      type: "script",
      authorId: "usr_creator",
      status: "draft",
      price: 0,
      tags: [],
      compatibility: { dependencies: [] },
    };
    mocks.createProduct.mockRejectedValueOnce(error);
    mocks.getProductPreviewBySlug.mockResolvedValueOnce(existingDraft);

    const response = await POST(
      request(validResourceInput),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      product: existingDraft,
      reusedDraft: true,
    });
    expect(mocks.getProductPreviewBySlug).toHaveBeenCalledWith(
      "resource-title",
      expect.objectContaining({ id: "usr_creator" }),
    );
  });

  it("does not reuse the creator's draft when submitted metadata has changed", async () => {
    mocks.createProduct.mockRejectedValueOnce({ cause: { code: "23505", constraint_name: "products_slug_unique" } });
    mocks.getProductPreviewBySlug.mockResolvedValueOnce({
      id: "prd_existing_draft",
      ...validResourceInput,
      authorId: "usr_creator",
      status: "draft",
    });

    const response = await POST(
      request({
        ...validResourceInput,
        description: "Changed description content.",
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "PRODUCT_SLUG_EXISTS",
    });
  });

  it("does not reinterpret unrelated unique constraints as a slug conflict", async () => {
    mocks.createProduct.mockRejectedValueOnce({ cause: { code: "23505", constraint_name: "audit_events_pkey" } });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await POST(request(validResourceInput));
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ code: "RESOURCE_CREATION_FAILED" });
      expect(mocks.getProductPreviewBySlug).not.toHaveBeenCalled();
    } finally { consoleError.mockRestore(); }
  });

  it("does not send internal error details back to the creator", async () => {
    mocks.createProduct.mockRejectedValueOnce(
      new Error("database connection string contains a secret"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await POST(request(validResourceInput));

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
