import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
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

function getRequest(token: string, buildId: string) {
  return new NextRequest(
    `http://nexus.test/api/admin/builds/${buildId}/download`,
    {
      method: "GET",
      headers: {
        cookie: `nexus_session=${token}`,
      },
    },
  );
}

function moderationRequest(
  token: string,
  buildId: string,
  action: "approve" | "reject",
  notes?: string,
) {
  return new NextRequest("http://nexus.test/api/admin/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `nexus_session=${token}`,
    },
    body: JSON.stringify({
      targetType: "build",
      targetId: buildId,
      action,
      ...(notes === undefined ? {} : { notes }),
    }),
  });
}

describe("build moderation route integration", () => {
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
      const ordinary = await downloadReviewerArtifact(
        getRequest(userToken, cleanBuildId),
        { params: Promise.resolve({ buildId: cleanBuildId }) },
      );
      expect(ordinary.status).toBe(403);

      const nonCleanDownload = await downloadReviewerArtifact(
        getRequest(moderatorToken, nonCleanBuildId),
        { params: Promise.resolve({ buildId: nonCleanBuildId }) },
      );
      expect(nonCleanDownload.status).toBe(422);
      expect(await nonCleanDownload.json()).toEqual({
        error: "Reviewer download requires a clean malware scan",
      });

      const reviewerDownload = await downloadReviewerArtifact(
        getRequest(moderatorToken, cleanBuildId),
        { params: Promise.resolve({ buildId: cleanBuildId }) },
      );
      expect(reviewerDownload.status).toBe(200);
      expect(reviewerDownload.headers.get("Content-Type")).toBe(
        "application/octet-stream",
      );
      expect(reviewerDownload.headers.get("Content-Disposition")).toContain(
        "attachment;",
      );
      expect(reviewerDownload.headers.get("X-Content-SHA256")).toBe(
        asset.sha256Hash,
      );
      expect(reviewerDownload.headers.get("Cache-Control")).toBe(
        "private, no-store",
      );
      expect(reviewerDownload.headers.get("Vary")).toBe("Cookie");
      expect(
        Buffer.from(await reviewerDownload.arrayBuffer()),
      ).toEqual(bytes);

      const missingNote = await moderate(
        moderationRequest(
          moderatorToken,
          cleanBuildId,
          "approve",
        ),
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

      expect(
        (await buildRepository.findById(cleanBuildId))?.status,
      ).toBe("published");

      const afterReview = await downloadReviewerArtifact(
        getRequest(moderatorToken, cleanBuildId),
        { params: Promise.resolve({ buildId: cleanBuildId }) },
      );
      expect(afterReview.status).toBe(409);
      expect(await afterReview.json()).toEqual({
        error: "Build is no longer pending review",
      });
    } finally {
      await storageService.deleteAsset(asset.key);
    }
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
        moderationRequest(
          moderatorToken,
          buildId,
          "approve",
          "Approve after clean review.",
        ),
      ),
      moderate(
        moderationRequest(
          moderatorToken,
          buildId,
          "reject",
          "Reject after independent review.",
        ),
      ),
    ]);

    expect([approve.status, reject.status].sort((a, b) => a - b)).toEqual([
      200,
      409,
    ]);

    const loser = approve.status === 409 ? approve : reject;
    expect(await loser.json()).toMatchObject({
      code: "BUILD_STATE_CHANGED",
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

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.targetId, buildId));

    const buildDecisionAudits = audits.filter(
      (audit) =>
        audit.action === "build.approved" ||
        audit.action === "build.rejected",
    );
    expect(buildDecisionAudits).toHaveLength(1);
    expect(buildDecisionAudits[0]?.actorId).toBe(moderatorId);
  });
});
