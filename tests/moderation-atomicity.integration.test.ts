import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import {
  auditEvents,
  buildRepository,
  contentRepository,
  db,
  productRepository,
  reportRepository,
  resourceModerationRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { POST as adminAction } from "../apps/web/src/app/api/admin/actions/route";

function adminRequest(
  token: string,
  body: Record<string, unknown>,
) {
  return new NextRequest("http://nexus.test/api/admin/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `nexus_session=${token}`,
    },
    body: JSON.stringify(body),
  });
}

describe("moderation atomicity integration", () => {
  it("releases moderation restrictions into a reviewable draft atomically", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const authorId = `usr_mod_author_${suffix}`;
    const adminId = `usr_mod_admin_${suffix}`;
    const token = `tok_mod_admin_${suffix}`;

    await userRepository.create({
      id: authorId,
      email: `mod_author_${suffix}@nexus.test`,
      username: `mod_author_${suffix}`,
      displayName: "Moderation Author",
      role: "developer",
    });
    await userRepository.create({
      id: adminId,
      email: `mod_admin_${suffix}@nexus.test`,
      username: `mod_admin_${suffix}`,
      displayName: "Moderation Admin",
      role: "admin",
    });
    await sessionRepository.create({
      id: `ses_mod_admin_${suffix}`,
      userId: adminId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const makeProduct = async (
      id: string,
      slug: string,
      status: "draft" | "published" | "suspended",
    ) =>
      productRepository.create({
        id,
        title: slug,
        slug,
        description: "Moderation state integration resource.",
        type: "script",
        status,
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

    const draftId = `prd_mod_draft_${suffix}`;
    const suspendedNoBuildId = `prd_mod_suspended_${suffix}`;
    const publishedId = `prd_mod_published_${suffix}`;

    await makeProduct(draftId, `mod-draft-${suffix}`, "draft");
    await makeProduct(
      suspendedNoBuildId,
      `mod-suspended-${suffix}`,
      "suspended",
    );
    await makeProduct(
      publishedId,
      `mod-published-${suffix}`,
      "published",
    );
    await buildRepository.create({
      id: `bld_mod_published_${suffix}`,
      productId: publishedId,
      version: "1.0.0",
      status: "published",
      storageKey: `assets/test/mod-${suffix}.zip`,
      sha256Hash: "d".repeat(64),
      fileSizeBytes: 10,
      fileName: "mod.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      isSigned: false,
    });

    const draftSuspend = await adminAction(
      adminRequest(token, {
        targetType: "product",
        targetId: draftId,
        action: "suspend",
        notes: "Must not publish by restore later.",
        expectedUpdatedAt: (await productRepository.findById(draftId))?.updatedAt.toISOString(),
      }),
    );
    expect(draftSuspend.status).toBe(200);
    expect((await productRepository.findById(draftId))?.status).toBe("suspended");

    const noBuildRestore = await adminAction(
      adminRequest(token, {
        targetType: "product",
        targetId: suspendedNoBuildId,
        action: "restore",
        notes: "Release into draft without publication.",
        expectedUpdatedAt: (await productRepository.findById(suspendedNoBuildId))?.updatedAt.toISOString(),
      }),
    );
    expect(noBuildRestore.status).toBe(200);
    expect((await productRepository.findById(suspendedNoBuildId))?.status).toBe("draft");

    const suspend = await adminAction(
      adminRequest(token, {
        targetType: "product",
        targetId: publishedId,
        action: "suspend",
        notes: "Temporary moderation suspension.",
        expectedUpdatedAt: (await productRepository.findById(publishedId))?.updatedAt.toISOString(),
      }),
    );
    expect(suspend.status).toBe(200);
    expect((await productRepository.findById(publishedId))?.status).toBe(
      "suspended",
    );

    const [suspensionAudit] = await db.select().from(auditEvents).where(eq(auditEvents.targetId, publishedId));
    expect(suspensionAudit).toBeDefined();
    const suspendedProduct = await productRepository.findById(publishedId);
    if (!suspendedProduct) throw new Error("Expected suspended resource fixture");
    await expect(resourceModerationRepository.command({
      actorId: adminId, productId: publishedId, auditId: suspensionAudit.id,
      command: { action: "release", reason: "Must roll back every transition.", expectedUpdatedAt: suspendedProduct.updatedAt.toISOString() },
    })).rejects.toBeTruthy();
    expect((await productRepository.findById(publishedId))?.status).toBe("suspended");
    expect((await buildRepository.findById(`bld_mod_published_${suffix}`))?.status).toBe("published");

    const restore = await adminAction(
      adminRequest(token, {
        targetType: "product",
        targetId: publishedId,
        action: "restore",
        notes: "Published builds must be reviewed again.",
        expectedUpdatedAt: (await productRepository.findById(publishedId))?.updatedAt.toISOString(),
      }),
    );
    expect(restore.status).toBe(200);
    expect((await productRepository.findById(publishedId))?.status).toBe("draft");
    expect((await buildRepository.findById(`bld_mod_published_${suffix}`))?.status).toBe("draft");

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.targetId, publishedId));
    expect(
      audits.filter(
        (event) =>
          event.action === "product.moderation_suspended" ||
          event.action === "product.moderation_released",
      ),
    ).toHaveLength(2);
  });

  it("rolls back content publication if its audit insert fails", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const authorId = `usr_content_atomic_${suffix}`;
    const contentId = `cnt_content_atomic_${suffix}`;
    const auditId = `aud_content_atomic_${suffix}`;

    await userRepository.create({
      id: authorId,
      email: `content_atomic_${suffix}@nexus.test`,
      username: `content_atomic_${suffix}`,
      displayName: "Content Atomic Author",
      role: "moderator",
    });
    await contentRepository.create({
      id: contentId,
      title: "Atomic moderation content",
      slug: `atomic-moderation-${suffix}`,
      body: "Content body",
      type: "article",
      authorId,
      status: "draft",
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      tags: [],
    });

    await db.insert(auditEvents).values({
      id: auditId,
      actorId: authorId,
      actorType: "user",
      action: "fixture.audit",
      targetId: contentId,
      targetType: "content",
      createdAt: new Date(),
    });

    await expect(
      contentRepository.moderateStatusWithAudit(
        contentId,
        "published",
        "draft",
        {
          id: auditId,
          actorId: authorId,
          actorType: "admin",
          action: "content.published",
          targetId: contentId,
          targetType: "content",
        },
      ),
    ).rejects.toBeTruthy();

    expect((await contentRepository.findById(contentId))?.status).toBe(
      "draft",
    );
  });

  it("resolves a report only once and commits its audit with the resolution", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const reporterId = `usr_report_atomic_${suffix}`;
    const moderatorId = `usr_report_mod_${suffix}`;
    const reportId = `rpt_atomic_${suffix}`;

    await userRepository.create({
      id: reporterId,
      email: `report_atomic_${suffix}@nexus.test`,
      username: `report_atomic_${suffix}`,
      displayName: "Report Atomic User",
      role: "user",
    });
    await userRepository.create({
      id: moderatorId,
      email: `report_mod_${suffix}@nexus.test`,
      username: `report_mod_${suffix}`,
      displayName: "Report Atomic Moderator",
      role: "moderator",
    });

    await reportRepository.create({
      id: reportId,
      reporterId,
      targetType: "user",
      targetId: reporterId,
      type: "other",
      reason: "Atomicity test report",
      evidenceUrls: [],
      status: "open",
    });

    const resolved = await reportRepository.resolve(
      reportId,
      "resolved",
      "Reviewed once.",
      {
        id: `aud_report_atomic_${suffix}`,
        actorId: moderatorId,
        actorType: "admin",
        action: "admin.resolve",
        targetId: reportId,
        targetType: "report",
      },
    );
    expect(resolved?.status).toBe("resolved");

    const second = await reportRepository.resolve(
      reportId,
      "dismissed",
      "Must not overwrite final state.",
      {
        id: `aud_report_atomic_second_${suffix}`,
        actorId: moderatorId,
        actorType: "admin",
        action: "admin.dismiss",
        targetId: reportId,
        targetType: "report",
      },
    );
    expect(second).toBeNull();

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.targetId, reportId));
    expect(
      audits.filter(
        (event) =>
          event.action === "admin.resolve" ||
          event.action === "admin.dismiss",
      ),
    ).toHaveLength(1);
  });
});
