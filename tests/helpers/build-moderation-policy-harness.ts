import { afterEach, beforeEach, vi } from "vitest";
import type { Build, Product, User } from "@nexus/domain";
import { eventBus } from "@nexus/domain";

export const buildModerationPolicyMocks = {
  findBuild: vi.fn(),
  findProduct: vi.fn(),
  moderatePending: vi.fn(),
  submitForReview: vi.fn(),
  can: vi.fn(),
};

export const buildModerationPolicyStaffPasswordHash = "hash_mod";

export const buildModerationPolicyModerator = {
  id: "usr_mod",
  username: "moderator",
  displayName: "Moderator",
  role: "moderator",
} as User;

export function buildModerationPolicyProduct(): Product {
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

export function buildModerationPolicyBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: "bld_1",
    productId: "prd_1",
    revision: 1,
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

export function installBuildModerationPolicyLifecycle() {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    buildModerationPolicyMocks.can.mockReturnValue(true);
    buildModerationPolicyMocks.findBuild.mockResolvedValue(buildModerationPolicyBuild());
    buildModerationPolicyMocks.findProduct.mockResolvedValue(buildModerationPolicyProduct());
    buildModerationPolicyMocks.moderatePending.mockResolvedValue(
      buildModerationPolicyBuild({ status: "published" }),
    );
    vi.spyOn(eventBus, "publish").mockResolvedValue(undefined);
  });
}
