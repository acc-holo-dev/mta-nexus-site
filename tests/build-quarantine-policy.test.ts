import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Build, User } from "@nexus/domain";

const mocks = vi.hoisted(() => ({
  findBuild: vi.fn(),
  quarantine: vi.fn(),
  restore: vi.fn(),
  can: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  buildRepository: {
    findById: mocks.findBuild,
    quarantinePublishedAndRefreshProduct: mocks.quarantine,
    restoreQuarantinedAndRefreshProduct: mocks.restore,
  },
  productRepository: {},
  organizationRepository: {},
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

function build(overrides: Partial<Build> = {}): Build {
  return {
    id: "bld_1",
    productId: "prd_1",
    version: "1.0.0",
    status: "published",
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

describe("build quarantine service behavior", () => {
  const service = new ProductService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockReturnValue(true);
    mocks.findBuild.mockResolvedValue(build());
    mocks.quarantine.mockResolvedValue(
      build({
        status: "quarantined",
        quarantinePreviousStatus: "published",
        quarantineReason: "Investigation",
      }),
    );
    mocks.restore.mockResolvedValue(build({ status: "published" }));
  });

  it("requires moderator permission before quarantine lookup", async () => {
    mocks.can.mockReturnValue(false);

    await expect(
      service.quarantineBuild(
        { buildId: "bld_1", reason: "Investigation" },
        moderator,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.findBuild).not.toHaveBeenCalled();
  });

  it("allows quarantine only from published state", async () => {
    mocks.findBuild.mockResolvedValue(build({ status: "pending_review" }));

    await expect(
      service.quarantineBuild(
        { buildId: "bld_1", reason: "Investigation" },
        moderator,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BUILD_QUARANTINE_INVALID_STATE",
    });
    expect(mocks.quarantine).not.toHaveBeenCalled();
  });

  it("maps quarantine compare-and-set loss to BUILD_STATE_CHANGED", async () => {
    mocks.quarantine.mockResolvedValue(null);

    await expect(
      service.quarantineBuild(
        { buildId: "bld_1", reason: "Investigation" },
        moderator,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BUILD_STATE_CHANGED",
    });
  });

  it("requires quarantined state before restore", async () => {
    mocks.findBuild.mockResolvedValue(build({ status: "published" }));

    await expect(
      service.restoreQuarantinedBuild(
        { buildId: "bld_1", reason: "Cleared" },
        moderator,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BUILD_QUARANTINE_INVALID_STATE",
    });
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it.each([
    { quarantinePreviousStatus: "draft" as const },
    { quarantinePreviousStatus: "published" as const, scanStatus: "infected" as const },
    { quarantinePreviousStatus: "published" as const, scanner: "" },
    { quarantinePreviousStatus: "published" as const, scannedAt: null },
  ])("rejects unsafe quarantine restore evidence %#", async (override) => {
    mocks.findBuild.mockResolvedValue(
      build({
        status: "quarantined",
        ...override,
      } as Partial<Build>),
    );

    await expect(
      service.restoreQuarantinedBuild(
        { buildId: "bld_1", reason: "Cleared" },
        moderator,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "BUILD_QUARANTINE_RESTORE_UNSAFE",
    });
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it("restores only after trusted clean quarantine evidence", async () => {
    const quarantined = build({
      status: "quarantined",
      quarantinePreviousStatus: "published",
      quarantineReason: "Investigation",
    });
    const restored = build({ status: "published" });
    mocks.findBuild.mockResolvedValue(quarantined);
    mocks.restore.mockResolvedValue(restored);

    await expect(
      service.restoreQuarantinedBuild(
        { buildId: "bld_1", reason: "Cleared" },
        moderator,
      ),
    ).resolves.toBe(restored);
    expect(mocks.restore).toHaveBeenCalledWith(
      "bld_1",
      expect.objectContaining({
        action: "build.quarantine_restored",
        details: expect.objectContaining({
          quarantineReason: "Investigation",
        }),
      }),
    );
  });
});
