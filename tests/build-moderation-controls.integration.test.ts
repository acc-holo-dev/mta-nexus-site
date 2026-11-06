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
import { storageService } from "@nexus/storage";
import { GET as downloadReviewerArtifact } from "../apps/web/src/app/api/admin/builds/[buildId]/download/route";
import { POST as moderate } from "../apps/web/src/app/api/admin/actions/route";
import {
  getRequest,
  moderationRequest,
} from "./helpers/build-moderation-controls-integration-harness";

describe("build moderation route integration", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("gates reviewer bytes and preserves build moderation HTTP semantics", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const authorId = `usr_build_author_${suffix}`;
    const moderatorId = `usr_build_mod_${suffix}`;
    const userId = `usr_build_user_${suffix}`;
    const productId = `prd_build_review_${suffix}`;
    const cleanBuildId = `bld_clean_${suffix}`;
    const nonCleanBuildId = `bld_nonclean_${suffix}`;
    const moderatorToken = `tok_build_mod_${suffix}`;
    const userToken = `tok_build_user_${suffix}`;
    const bytes = Buffer.from("reviewer-build-artifact");

    await userRepository.create({
      id: authorId,
      email: `build_author_${suffix}@nexus.test`,
      username: `build_author_${suffix}`,
      displayName: "Build Author",
      role: "developer",
    });
    await userRepository.create({
      id: moderatorId,
      email: `build_mod_${suffix}@nexus.test`,
      username: `build_mod_${suffix}`,
      displayName: "Build Moderator",
      role: "moderator",
    });
    await userRepository.create({
      id: userId,
      email: `build_user_${suffix}@nexus.test`,
      username: `build_user_${suffix}`,
      displayName: "Build User",
      role: "user",
    });
    await sessionRepository.create({
      id: `ses_build_mod_${suffix}`,
      userId: moderatorId,
      token: moderatorToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await assignIntegrationStaffPassword(moderatorId);
    await sessionRepository.create({
      id: `ses_build_user_${suffix}`,
      userId,
      token: userToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await productRepository.create({
      id: productId,
      title: "Build Review Integration Resource",
      slug: `build-review-${suffix}`,
      description: "Resource used to prove moderator build review controls.",
      type: "script",
      status: "pending_review",
      authorId,
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
    });

    const asset = await storageService.uploadAsset({
      data: bytes,
      fileName: "review-artifact.zip",
      mimeType: "application/zip",
      userId: authorId,
      isPrivate: true,
    });

    await buildRepository.create({
      id: cleanBuildId,
      productId,
      version: "1.0.0",
      releaseNotes: "clean review build",
      storageKey: asset.key,
      sha256Hash: asset.sha256Hash,
      fileSizeBytes: asset.sizeBytes,
      fileName: "review-artifact.zip",
      mimeType: "application/zip",
      status: "pending_review",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      isSigned: false,
    });
    await buildRepository.create({
      id: nonCleanBuildId,
      productId,
      version: "1.0.1",
      releaseNotes: "non-clean review build",
      storageKey: "assets/not-used/non-clean.zip",
      sha256Hash: "b".repeat(64),
      fileSizeBytes: 10,
      fileName: "non-clean.zip",
      mimeType: "application/zip",
      status: "pending_review",
      scanStatus: "not_scanned",
      scanner: "disabled",
      scannedAt: new Date(),
      isSigned: false,
    });

    try {
      const ordinary = await downloadReviewerArtifact(getRequest(userToken, cleanBuildId), {
        params: Promise.resolve({ buildId: cleanBuildId }),
      });
      expect(ordinary.status).toBe(403);

      const nonCleanDownload = await downloadReviewerArtifact(
        getRequest(moderatorToken, nonCleanBuildId),
        { params: Promise.resolve({ buildId: nonCleanBuildId }) },
      );
      expect(nonCleanDownload.status).toBe(422);
      expect(await nonCleanDownload.json()).toEqual({
        error: "Reviewer download requires a provenance-backed clean malware scan",
      });

      const reviewerDownload = await downloadReviewerArtifact(
        getRequest(moderatorToken, cleanBuildId),
        { params: Promise.resolve({ buildId: cleanBuildId }) },
      );
      expect(reviewerDownload.status).toBe(200);
      expect(reviewerDownload.headers.get("Content-Type")).toBe("application/octet-stream");
      expect(reviewerDownload.headers.get("Content-Disposition")).toContain("attachment;");
      expect(reviewerDownload.headers.get("X-Content-SHA256")).toBe(asset.sha256Hash);
      expect(reviewerDownload.headers.get("Cache-Control")).toBe("private, no-store");
      expect(reviewerDownload.headers.get("Vary")).toBe("Cookie");
      expect(Buffer.from(await reviewerDownload.arrayBuffer())).toEqual(bytes);

      const reviewerAudits = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.targetId, cleanBuildId));
      expect(
        reviewerAudits.some((audit) => audit.action === "build.review_artifact_download_started"),
      ).toBe(true);
      expect(
        reviewerAudits.some((audit) => audit.action === "build.review_artifact_downloaded"),
      ).toBe(false);

      const missingNote = await moderate(
        moderationRequest(moderatorToken, cleanBuildId, "approve"),
      );
      expect(missingNote.status).toBe(400);

      const nonCleanApprove = await moderate(
        moderationRequest(
          moderatorToken,
          nonCleanBuildId,
          "approve",
          "Scanner did not produce a clean verdict.",
        ),
      );
      expect(nonCleanApprove.status).toBe(422);
      expect(await nonCleanApprove.json()).toMatchObject({
        code: "BUILD_SCAN_NOT_CLEAN",
      });

      const approved = await moderate(
        moderationRequest(
          moderatorToken,
          cleanBuildId,
          "approve",
          "Reviewed clean scan, hash and release metadata.",
        ),
      );
      expect(approved.status).toBe(200);
      expect(await approved.json()).toMatchObject({
        success: true,
        action: "approve",
        targetId: cleanBuildId,
      });

      expect((await buildRepository.findById(cleanBuildId))?.status).toBe("published");

      const afterReview = await downloadReviewerArtifact(getRequest(moderatorToken, cleanBuildId), {
        params: Promise.resolve({ buildId: cleanBuildId }),
      });
      expect(afterReview.status).toBe(409);
      expect(await afterReview.json()).toEqual({
        error: "Build is not available for moderator evidence review",
      });

      const quarantined = await moderate(
        moderationRequest(
          moderatorToken,
          cleanBuildId,
          "quarantine",
          "Contain the published artifact while the reviewer rechecks evidence.",
        ),
      );
      expect(quarantined.status).toBe(200);
      expect(await quarantined.json()).toMatchObject({
        success: true,
        action: "quarantine",
        targetId: cleanBuildId,
      });
      expect((await buildRepository.findById(cleanBuildId))?.status).toBe("quarantined");

      const quarantineEvidence = await downloadReviewerArtifact(
        getRequest(moderatorToken, cleanBuildId),
        { params: Promise.resolve({ buildId: cleanBuildId }) },
      );
      expect(quarantineEvidence.status).toBe(200);
      expect(quarantineEvidence.headers.get("Cache-Control")).toBe("private, no-store");
      expect(Buffer.from(await quarantineEvidence.arrayBuffer())).toEqual(bytes);

      const restored = await moderate(
        moderationRequest(
          moderatorToken,
          cleanBuildId,
          "restore",
          "Evidence review confirms the trusted clean artifact can return.",
        ),
      );
      expect(restored.status).toBe(200);
      expect(await restored.json()).toMatchObject({
        success: true,
        action: "restore",
        targetId: cleanBuildId,
      });
      expect((await buildRepository.findById(cleanBuildId))?.status).toBe("published");
    } finally {
      await storageService.deleteAsset(asset.key);
    }
  });
});
