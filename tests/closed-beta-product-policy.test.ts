import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product, User } from "@nexus/domain";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  createWithAudit: vi.fn(),
  findLatestPublishedByProduct: vi.fn(),
  can: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  productRepository: {
    list: mocks.list,
    findById: mocks.findById,
    findBySlug: mocks.findBySlug,
    createWithAudit: mocks.createWithAudit,
    findPublishedFreeBySlugs: vi.fn(async () => []),
    listPublishedFreeDependingOnSlug: vi.fn(async () => []),
  },
  buildRepository: {
    findLatestPublishedByProduct: mocks.findLatestPublishedByProduct,
    listPublishedByProduct: vi.fn(async () => []),
    listByProduct: vi.fn(async () => []),
  },
  organizationRepository: {
    findById: vi.fn(),
    listUserMemberships: vi.fn(async () => []),
  },
}));

vi.mock("@nexus/security", () => ({
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
  can: mocks.can,
}));

import { ProductService } from "../apps/web/src/lib/services/product-service";

const actor = {
  id: "usr_dev",
  username: "developer",
  displayName: "Developer",
  role: "developer",
} as User;

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prd_1",
    authorId: actor.id,
    title: "Resource",
    slug: "resource",
    description: "Resource description",
    type: "script",
    status: "published",
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
  } as Product;
}

function createInput(price: number) {
  const value = product({ price, status: "draft" });
  const {
    id: _id,
    ratingAverage: _ratingAverage,
    ratingCount: _ratingCount,
    salesCount: _salesCount,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = value;
  return input;
}

describe("closed-beta product behavior", () => {
  const service = new ProductService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockReturnValue(true);
    mocks.list.mockResolvedValue([]);
    mocks.findLatestPublishedByProduct.mockResolvedValue({ id: "bld_1" });
  });

  it("rejects paid product creation before permission or persistence work", async () => {
    await expect(
      service.createProduct(createInput(1500), actor),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "PAID_RESOURCES_DISABLED",
    });

    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
  });

  it("rejects build release preflight for a legacy paid product", async () => {
    mocks.findById.mockResolvedValue(product({ price: 1000 }));

    await expect(
      service.assertCanReleaseBuild("prd_1", actor),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "PAID_RESOURCES_DISABLED",
    });
    expect(mocks.can).not.toHaveBeenCalled();
  });

  it("forces public listing queries into the free-only range", async () => {
    await service.listProducts({
      minPrice: 100,
      maxPrice: 9999,
      sort: "price_desc",
      query: "resource",
    });

    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        minPrice: 0,
        maxPrice: 0,
        sort: "price_desc",
        query: "resource",
      }),
    );
  });

  it("hides a legacy paid product from public slug access", async () => {
    mocks.findBySlug.mockResolvedValue(product({ price: 500 }));

    await expect(service.getProductBySlug("resource")).resolves.toBeNull();
    expect(mocks.findLatestPublishedByProduct).not.toHaveBeenCalled();
  });

  it("keeps a published free product available when a published build exists", async () => {
    const free = product();
    mocks.findBySlug.mockResolvedValue(free);

    await expect(service.getProductBySlug("resource")).resolves.toBe(free);
    expect(mocks.findLatestPublishedByProduct).toHaveBeenCalledWith("prd_1");
  });
});
