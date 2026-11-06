import { describe, expect, it, vi } from "vitest";
import { eventBus } from "@nexus/domain";

vi.mock("@nexus/db", async () => {
  const { buildModerationPolicyMocks } = await import("./helpers/build-moderation-policy-harness");
  return {
    buildRepository: {
      findById: buildModerationPolicyMocks.findBuild,
      moderatePending: buildModerationPolicyMocks.moderatePending,
      submitForReview: buildModerationPolicyMocks.submitForReview,
    },
    productRepository: {
      findById: buildModerationPolicyMocks.findProduct,
    },
    organizationRepository: {
      findById: vi.fn(),
      listUserMemberships: vi.fn(async () => []),
    },
  };
});

vi.mock("@nexus/security", async () => {
  const { buildModerationPolicyMocks } = await import("./helpers/build-moderation-policy-harness");
  return {
    can: buildModerationPolicyMocks.can,
    generateId: vi.fn((prefix: string) => `${prefix}_test`),
  };
});

import { ProductService } from "../apps/web/src/lib/services/product-service";
import {
  buildModerationPolicyBuild as build,
  buildModerationPolicyMocks as mocks,
  buildModerationPolicyModerator as moderator,
  buildModerationPolicyProduct as product,
  buildModerationPolicyStaffPasswordHash as staffPasswordHash,
  installBuildModerationPolicyLifecycle,
} from "./helpers/build-moderation-policy-harness";

installBuildModerationPolicyLifecycle();

describe("build moderation service events", () => {
  const service = new ProductService();

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
        "moderator-session",
      ),
    ).resolves.toBe(pending);

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "build.submitted_for_review",
        aggregateType: "build",
        payload: expect.objectContaining({
          productId: "prd_1",
          version: "1.0.0",
        }),
      }),
    );
    expect(eventBus.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "build.released" }),
    );
  });

  it("publishes build.released only after a successful approval", async () => {
    const reviewed = build({ status: "published" });
    mocks.moderatePending.mockResolvedValue(reviewed);

    await expect(
      service.reviewBuild(
        {
          buildId: "bld_1",
          expectedRevision: 1,
          decision: "approve",
          notes: "Reviewed clean build",
          expectedPasswordHash: staffPasswordHash,
        },
        moderator,
        "staff-session",
      ),
    ).resolves.toBe(reviewed);

    expect(mocks.moderatePending).toHaveBeenCalledWith(
      "bld_1",
      "approve",
      expect.objectContaining({
        action: "build.approved",
        details: expect.objectContaining({ notes: "Reviewed clean build" }),
      }),
      1,
      "staff-session",
      staffPasswordHash,
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
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
        {
          buildId: "bld_1",
          expectedRevision: 1,
          decision: "reject",
          notes: "Rejected",
          expectedPasswordHash: staffPasswordHash,
        },
        moderator,
        "staff-session",
      ),
    ).resolves.toBe(reviewed);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
