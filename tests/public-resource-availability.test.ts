import { beforeEach, describe, expect, it, vi } from "vitest";

const productRepository = vi.hoisted(() => ({
  findBySlug: vi.fn(),
  findById: vi.fn(),
}));

const buildRepository = vi.hoisted(() => ({
  findLatestPublishedByProduct: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  productRepository,
  buildRepository,
  organizationRepository: {},
}));

vi.mock("@nexus/security", () => ({
  generateId: vi.fn(),
  can: vi.fn(() => false),
}));

vi.mock("@nexus/domain", async () => {
  const actual = await vi.importActual<typeof import("@nexus/domain")>(
    "@nexus/domain",
  );
  return {
    ...actual,
    eventBus: { publish: vi.fn() },
  };
});

import { ProductService } from "../apps/web/src/lib/services/product-service";

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "prd_public",
    title: "Public Resource",
    slug: "public-resource",
    description: "Public resource availability behavior fixture.",
    type: "script",
    status: "published",
    authorId: "usr_author",
    organizationId: null,
    price: 0,
    currency: "USD",
    licenseModel: "unlimited",
    tags: [],
    currentVersion: "1.0.0",
    ratingAverage: 0,
    ratingCount: 0,
    salesCount: 0,
    isFeatured: false,
    screenshots: [],
    compatibility: { dependencies: [] },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("public resource availability", () => {
  const service = new ProductService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["slug", () => service.getProductBySlug("public-resource")],
    ["id", () => service.getProductById("prd_public")],
  ] as const)(
    "fails closed for published free %s detail without a safe build",
    async (_kind, load) => {
      const value = product();
      productRepository.findBySlug.mockResolvedValue(value);
      productRepository.findById.mockResolvedValue(value);
      buildRepository.findLatestPublishedByProduct.mockResolvedValue(null);

      await expect(load()).resolves.toBeNull();
      expect(
        buildRepository.findLatestPublishedByProduct,
      ).toHaveBeenCalledWith("prd_public");
    },
  );

  it.each([
    ["slug", () => service.getProductBySlug("public-resource")],
    ["id", () => service.getProductById("prd_public")],
  ] as const)(
    "returns published free %s detail when a safe build exists",
    async (_kind, load) => {
      const value = product();
      productRepository.findBySlug.mockResolvedValue(value);
      productRepository.findById.mockResolvedValue(value);
      buildRepository.findLatestPublishedByProduct.mockResolvedValue({
        id: "bld_safe",
        productId: "prd_public",
        status: "published",
      });

      await expect(load()).resolves.toEqual(value);
    },
  );

  it.each([
    product({ status: "draft" }),
    product({ price: 100 }),
  ])("rejects non-public products before build lookup", async (value) => {
    productRepository.findBySlug.mockResolvedValue(value);
    productRepository.findById.mockResolvedValue(value);

    await expect(service.getProductBySlug(value.slug)).resolves.toBeNull();
    await expect(service.getProductById(value.id)).resolves.toBeNull();
    expect(
      buildRepository.findLatestPublishedByProduct,
    ).not.toHaveBeenCalled();
  });
});
