import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Build, Product, User } from "@nexus/domain";
import { eventBus } from "@nexus/domain";

const mocks = vi.hoisted(() => ({
  findBuild: vi.fn(),
  findProduct: vi.fn(),
  moderatePending: vi.fn(),
  submitForReview: vi.fn(),
  can: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  buildRepository: {
    findById: mocks.findBuild,
    moderatePending: mocks.moderatePending,
    submitForReview: mocks.submitForReview,
  },
  productRepository: {
    findById: mocks.findProduct,
  },
  organizationRepository: {
    findById: vi.fn(),
    listUserMemberships: vi.fn(async () => []),
  },
}));

vi.mock("@nexus/security", () => ({
  can: mocks.can,
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
}));

import { ProductService } from "../apps/web/src/lib/services/product-service";

const moderator = {
  id: "usr_mod",
  username: "moderator",
  displayName: "Moderator",
  role: "moderator",
} as User;

function product(): Product {
  return {
    id: "prd_1",
    authorId: "usr_author",
    title: "Resource",
    slug: "resource",
    description: "Resource",
    type: "script",
    status: "pending_review",
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
  } as Product;
}

function build(overrides: Partial<Build> = {}): Build {
  return {
    id: "bld_1",
    productId: "prd_1",
    version: "1.0.0",
    releaseNotes: "Release",
    status: "pending_review",
    storageKey: "test/bld_1.zip",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 42,
    fileName: "resource.zip",
    mimeType: "application/zip",
    scanStatus: "clean",
    scanner: "test-scanner",
    scannedAt: new Date("2026-01-01T00:00:00.000Z"),
    isSigned: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Build;
}

describe("build moderation service behavior", () => {
  const service = new ProductService();
  let publishSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockReturnValue(true);
    mocks.findBuild.mockResolvedValue(build());
    mocks.findProduct.mockResolvedValue(product());
    mocks.moderatePending.mockResolvedValue(build({ status: "published" }));
    publishSpy = vi.spyOn(eventBus, "publish").mockResolvedValue(undefined);
  });

  it("requires moderator permission before reading the build", async () => {
    mocks.can.mockReturnValue(false);

    await expect(
      service.reviewBuild(
        { buildId: "bld_1", decision: "approve", notes: "Reviewed" },
        moderator,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.findBuild).not.toHaveBeenCalled();
  });

  it("rejects review after the build has left pending_review", async () => {
    mocks.findBuild.mockResolvedValue(build({ status: "published" }));

    await expect(
      service.reviewBuild(
        { buildId: "bld_1", decision: "approve", notes: "Reviewed" },
        moderator,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BUILD_NOT_PENDING_REVIEW",
    });
    expect(mocks.moderatePending).not.toHaveBeenCalled();
  });

  it.each([
    { scanStatus: "infected" as const },
    { scanStatus: "clean" as const, scanner: "" },
    { scanStatus: "clean" as const, scannedAt: null },
  ])("rejects approval without trusted clean scan provenance %#", async (override) => {
    mocks.findBuild.mockResolvedValue(build(override as Partial<Build>));

    await expect(
      service.reviewBuild(
        { buildId: "bld_1", decision: "approve", notes: "Reviewed" },
        moderator,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "BUILD_SCAN_NOT_CLEAN",
    });
    expect(mocks.moderatePending).not.toHaveBeenCalled();
  });

  it("maps a lost moderation compare-and-set to BUILD_STATE_CHANGED", async () => {
    mocks.moderatePending.mockResolvedValue(null);

    await expect(
      service.reviewBuild(
        { buildId: "bld_1", decision: "reject", notes: "Reviewed" },
        moderator,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BUILD_STATE_CHANGED",
    });
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it("publishes submitted_for_review, never released, when an author submits a build", async () => {
    const pending = build({
      id: "bld_test",
      status: "pending_review",
    });
    mocks.submitForReview.mockResolvedValue(pending);
    vi.spyOn(service, "assertCanReleaseBuild").mockResolvedValue(product());

    await expect(
      service.releaseBuild(
        {
          productId: "prd_1",
          version: "1.0.0",
          releaseNotes: "Submission",
          storageKey: "test/bld_test.zip",
          sha256Hash: "a".repeat(64),
          fileSizeBytes: 42,
          fileName: "resource.zip",
          mimeType: "application/zip",
          scanStatus: "clean",
          scanner: "test-scanner",
          scannedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        moderator,
      ),
    ).resolves.toBe(pending);

    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "build.submitted_for_review",
        aggregateType: "build",
        payload: expect.objectContaining({
          productId: "prd_1",
          version: "1.0.0",
        }),
      }),
    );
    expect(publishSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "build.released" }),
    );
  });

  it("publishes build.released only after a successful approval", async () => {
    const reviewed = build({ status: "published" });
    mocks.moderatePending.mockResolvedValue(reviewed);

    await expect(
      service.reviewBuild(
        { buildId: "bld_1", decision: "approve", notes: "Reviewed clean build" },
        moderator,
      ),
    ).resolves.toBe(reviewed);

    expect(mocks.moderatePending).toHaveBeenCalledWith(
      "bld_1",
      "approve",
      expect.objectContaining({
        action: "build.approved",
        details: expect.objectContaining({ notes: "Reviewed clean build" }),
      }),
    );
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "build.released",
        aggregateId: "bld_1",
      }),
    );
  });

  it("does not publish build.released after a successful rejection", async () => {
    const reviewed = build({ status: "rejected" });
    mocks.moderatePending.mockResolvedValue(reviewed);

    await expect(
      service.reviewBuild(
        { buildId: "bld_1", decision: "reject", notes: "Rejected" },
        moderator,
      ),
    ).resolves.toBe(reviewed);
    expect(publishSpy).not.toHaveBeenCalled();
  });
});
