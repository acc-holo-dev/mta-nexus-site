import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product, User } from "@nexus/domain";

const mocks = vi.hoisted(() => ({
  findBySlug: vi.fn(),
  listPublishedByProduct: vi.fn(),
  listByProduct: vi.fn(),
  can: vi.fn(),
  hasManagementAccess: vi.fn(),
  findOrganizationById: vi.fn(),
  listUserMemberships: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  productRepository: {
    findBySlug: mocks.findBySlug,
    hasManagementAccess: mocks.hasManagementAccess,
    findPublishedFreeBySlugs: vi.fn(async () => []),
    listPublishedFreeDependingOnSlug: vi.fn(async () => []),
  },
  buildRepository: {
    listPublishedByProduct: mocks.listPublishedByProduct,
    listByProduct: mocks.listByProduct,
  },
  organizationRepository: {
    findById: mocks.findOrganizationById,
    listUserMemberships: mocks.listUserMemberships,
  },
}));

vi.mock("@nexus/security", () => ({
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
  can: mocks.can,
}));

import { ProductService } from "../apps/web/src/lib/services/product-service";

const outsider = {
  id: "usr_outsider",
  username: "outsider",
  displayName: "Outsider",
  role: "user",
} as User;

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prd_visibility",
    authorId: "usr_owner",
    title: "Visibility fixture",
    slug: "visibility-fixture",
    description: "Visibility fixture",
    type: "script",
    status: "draft",
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

describe("resource build visibility behavior", () => {
  const service = new ProductService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPublishedByProduct.mockResolvedValue([{ id: "bld_public", status: "published" }]);
    mocks.listByProduct.mockResolvedValue([
      { id: "bld_public", status: "published" },
      { id: "bld_pending", status: "pending_review" },
    ]);
    mocks.listUserMemberships.mockResolvedValue([]);
    mocks.findOrganizationById.mockResolvedValue(null);
    mocks.can.mockReturnValue(false);
    mocks.hasManagementAccess.mockResolvedValue(false);
  });

  it("uses the published-only repository path for public build history", async () => {
    await expect(service.getProductBuilds("prd_visibility")).resolves.toEqual([
      expect.objectContaining({
        id: "bld_public",
        status: "published",
      }),
    ]);

    expect(mocks.listPublishedByProduct).toHaveBeenCalledWith("prd_visibility");
    expect(mocks.listByProduct).not.toHaveBeenCalled();
  });

  it("uses full lifecycle history only when caller explicitly has inspection access", async () => {
    await expect(service.getProductBuilds("prd_visibility", true)).resolves.toEqual([
      expect.objectContaining({ id: "bld_public" }),
      expect.objectContaining({
        id: "bld_pending",
        status: "pending_review",
      }),
    ]);

    expect(mocks.listByProduct).toHaveBeenCalledWith("prd_visibility");
    expect(mocks.listPublishedByProduct).not.toHaveBeenCalled();
  });

  it("hides non-published previews from guests and unauthorized users", async () => {
    const draft = product();
    mocks.findBySlug.mockResolvedValue(draft);

    await expect(service.getProductPreviewBySlug(draft.slug, null)).resolves.toBeNull();

    expect(mocks.hasManagementAccess).not.toHaveBeenCalled();

    await expect(service.getProductPreviewBySlug(draft.slug, outsider)).resolves.toBeNull();

    expect(mocks.hasManagementAccess).toHaveBeenCalledExactlyOnceWith(draft.id, outsider);
    expect(mocks.can).not.toHaveBeenCalled();
  });

  it("allows an authorized manager to preview a non-published resource", async () => {
    const draft = product();
    mocks.findBySlug.mockResolvedValue(draft);
    mocks.hasManagementAccess.mockResolvedValue(true);

    await expect(service.getProductPreviewBySlug(draft.slug, outsider)).resolves.toBe(draft);
    expect(mocks.hasManagementAccess).toHaveBeenCalledExactlyOnceWith(draft.id, outsider);
  });

  it("propagates a failed live access lookup without returning the draft", async () => {
    const draft = product();
    mocks.findBySlug.mockResolvedValue(draft);
    mocks.hasManagementAccess.mockRejectedValue(new Error("Database unavailable"));
    mocks.can.mockReturnValue(true);
    await expect(service.getProductPreviewBySlug(draft.slug, outsider)).rejects.toThrow(
      "Database unavailable",
    );
    expect(mocks.can).not.toHaveBeenCalled();
  });

  it("never exposes a legacy paid resource through preview access", async () => {
    const paid = product({ price: 1000 });
    mocks.findBySlug.mockResolvedValue(paid);
    mocks.can.mockReturnValue(true);
    mocks.hasManagementAccess.mockResolvedValue(true);

    await expect(service.getProductPreviewBySlug(paid.slug, outsider)).resolves.toBeNull();
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.hasManagementAccess).not.toHaveBeenCalled();
  });
});
