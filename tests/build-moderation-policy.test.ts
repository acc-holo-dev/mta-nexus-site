import { describe, expect, it, vi } from "vitest";
import type { Build } from "@nexus/domain";
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
  buildModerationPolicyStaffPasswordHash as staffPasswordHash,
  installBuildModerationPolicyLifecycle,
} from "./helpers/build-moderation-policy-harness";

installBuildModerationPolicyLifecycle();

describe("build moderation service behavior", () => {
  const service = new ProductService();

  it("requires moderator permission before reading the build", async () => {
    mocks.can.mockReturnValue(false);

    await expect(
      service.reviewBuild(
        {
          buildId: "bld_1",
          expectedRevision: 1,
          decision: "approve",
          notes: "Reviewed",
          expectedPasswordHash: staffPasswordHash,
        },
        moderator,
        "staff-session",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.findBuild).not.toHaveBeenCalled();
  });

  it("rejects review after the build has left pending_review", async () => {
    mocks.findBuild.mockResolvedValue(build({ status: "published" }));

    await expect(
      service.reviewBuild(
        {
          buildId: "bld_1",
          expectedRevision: 1,
          decision: "approve",
          notes: "Reviewed",
          expectedPasswordHash: staffPasswordHash,
        },
        moderator,
        "staff-session",
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
        {
          buildId: "bld_1",
          expectedRevision: 1,
          decision: "approve",
          notes: "Reviewed",
          expectedPasswordHash: staffPasswordHash,
        },
        moderator,
        "staff-session",
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
        {
          buildId: "bld_1",
          expectedRevision: 1,
          decision: "reject",
          notes: "Reviewed",
          expectedPasswordHash: staffPasswordHash,
        },
        moderator,
        "staff-session",
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BUILD_STATE_CHANGED",
    });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
