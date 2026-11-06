import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubBrowserMutationOrigin } from "./browser-mutation-headers";
import { assignIntegrationStaffPassword } from "./integration-staff-password";
import { eq } from "drizzle-orm";
import {
  auditEvents,
  buildRepository,
  db,
  productRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { POST as moderate } from "../apps/web/src/app/api/admin/actions/route";
import { moderationRequest } from "./helpers/build-moderation-controls-integration-harness";

describe("build moderation concurrent decisions", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("serializes concurrent moderator decisions and writes exactly one build decision audit", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const authorId = `usr_build_race_author_${suffix}`;
    const moderatorId = `usr_build_race_mod_${suffix}`;
    const moderatorToken = `tok_build_race_mod_${suffix}`;
    const productId = `prd_build_race_${suffix}`;
    const buildId = `bld_build_race_${suffix}`;

    await userRepository.create({
      id: authorId,
      email: `build_race_author_${suffix}@nexus.test`,
      username: `build_race_author_${suffix}`,
      displayName: "Build Race Author",
      role: "developer",
    });
    await userRepository.create({
      id: moderatorId,
      email: `build_race_mod_${suffix}@nexus.test`,
      username: `build_race_mod_${suffix}`,
      displayName: "Build Race Moderator",
      role: "moderator",
    });
    await sessionRepository.create({
      id: `ses_build_race_mod_${suffix}`,
      userId: moderatorId,
      token: moderatorToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await assignIntegrationStaffPassword(moderatorId);

    await productRepository.create({
      id: productId,
      title: "Build Moderation Race Resource",
      slug: `build-moderation-race-${suffix}`,
      description: "Resource used to prove moderation decision serialization.",
      type: "script",
      status: "pending_review",
      authorId,
      price: 0,
      currency: "USD",
      licenseModel: "unlimited",
      tags: [],
      currentVersion: "5.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: { dependencies: [] },
    });

    await buildRepository.create({
      id: buildId,
      productId,
      version: "5.0.0",
      releaseNotes: "concurrent moderator decision",
      storageKey: `assets/test/${buildId}.zip`,
      sha256Hash: "c".repeat(64),
      fileSizeBytes: 32,
      fileName: "race.zip",
      mimeType: "application/zip",
      status: "pending_review",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      isSigned: false,
    });

    const [approve, reject] = await Promise.all([
      moderate(
        moderationRequest(moderatorToken, buildId, "approve", "Approve after clean review."),
      ),
      moderate(
        moderationRequest(moderatorToken, buildId, "reject", "Reject after independent review."),
      ),
    ]);

    expect([approve.status, reject.status].sort((a, b) => a - b)).toEqual([200, 409]);

    const loser = approve.status === 409 ? approve : reject;
    // The loser is rejected either by the pending-review pre-check or by the
    // moderated-row guard; both are 409 build state conflicts.
    expect(await loser.json()).toMatchObject({
      code: expect.stringMatching(/^BUILD_(NOT_PENDING_REVIEW|STATE_CHANGED)$/),
    });

    const build = await buildRepository.findById(buildId);
    expect(["published", "rejected"]).toContain(build?.status);

    const product = await productRepository.findById(productId);
    if (build?.status === "published") {
      expect(product?.status).toBe("published");
      expect(product?.currentVersion).toBe("5.0.0");
    } else {
      expect(product?.status).toBe("draft");
    }

    const audits = await db.select().from(auditEvents).where(eq(auditEvents.targetId, buildId));

    const buildDecisionAudits = audits.filter(
      (audit) => audit.action === "build.approved" || audit.action === "build.rejected",
    );
    expect(buildDecisionAudits).toHaveLength(1);
    expect(buildDecisionAudits[0]?.actorId).toBe(moderatorId);
  });
});
