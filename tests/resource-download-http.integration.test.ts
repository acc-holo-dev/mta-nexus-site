import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import {
  auditEvents,
  buildRepository,
  db,
  entitlementRepository,
  productRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { storageService } from "@nexus/storage";
import { GET as downloadResource } from "../apps/web/src/app/api/products/[id]/download/route";

describe("resource download HTTP integration", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_download_author_${suffix}`;
  const userId = `usr_download_user_${suffix}`;
  const otherUserId = `usr_download_other_${suffix}`;
  const sessionToken = `tok_download_${suffix}`;
  const otherSessionToken = `tok_download_other_${suffix}`;
  const publishedProductId = `prd_download_pub_${suffix}`;
  const draftProductId = `prd_download_draft_${suffix}`;
  const noBuildProductId = `prd_download_nobuild_${suffix}`;
  let storageKey: string | null = null;

  function request(productId: string, token: string) {
    return {
      request: new NextRequest(`http://nexus.test/api/products/${productId}/download`, {
        method: "GET",
        headers: { cookie: `nexus_session=${token}` },
      }),
      context: { params: Promise.resolve({ id: productId }) },
    };
  }

  async function createProduct(input: { id: string; slug: string; status: "published" | "draft" }) {
    await productRepository.create({
      id: input.id,
      title: `Download ${input.slug}`,
      slug: input.slug,
      description: "J5 download integration resource.",
      type: "script",
      status: input.status,
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
  }

  it("proves published entitlement delivery and fail-closed denial states", async () => {
    await userRepository.create({
      id: authorId,
      email: `download_author_${suffix}@nexus.test`,
      username: `download_author_${suffix}`,
      displayName: "Download Author",
      role: "developer",
    });
    await userRepository.create({
      id: userId,
      email: `download_user_${suffix}@nexus.test`,
      username: `download_user_${suffix}`,
      displayName: "Download User",
      role: "user",
    });
    await userRepository.create({
      id: otherUserId,
      email: `download_other_${suffix}@nexus.test`,
      username: `download_other_${suffix}`,
      displayName: "Download Other User",
      role: "user",
    });

    await sessionRepository.create({
      id: `ses_download_${suffix}`,
      userId,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await sessionRepository.create({
      id: `ses_download_other_${suffix}`,
      userId: otherUserId,
      token: otherSessionToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await createProduct({
      id: publishedProductId,
      slug: `download-published-${suffix}`,
      status: "published",
    });
    await createProduct({
      id: draftProductId,
      slug: `download-draft-${suffix}`,
      status: "draft",
    });
    await createProduct({
      id: noBuildProductId,
      slug: `download-no-build-${suffix}`,
      status: "published",
    });

    for (const productId of [publishedProductId, draftProductId, noBuildProductId]) {
      await entitlementRepository.create({
        id: `ent_${productId}`,
        subjectType: "user",
        subjectId: userId,
        permission: "product.download",
        resourceId: productId,
      });
    }

    const bytes = new TextEncoder().encode("nexus-j5-download-integration");
    const asset = await storageService.uploadAsset({
      data: bytes,
      fileName: "resource.zip",
      mimeType: "application/zip",
      userId: authorId,
      isPrivate: true,
    });
    storageKey = asset.key;

    await buildRepository.create({
      id: `bld_download_${suffix}`,
      productId: publishedProductId,
      version: "1.0.0",
      status: "published",
      storageKey: asset.key,
      sha256Hash: asset.sha256Hash,
      fileSizeBytes: asset.sizeBytes,
      fileName: "resource.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      isSigned: false,
    });

    const successInput = request(publishedProductId, sessionToken);
    const success = await downloadResource(successInput.request, successInput.context);

    expect(success.status).toBe(200);
    expect(success.headers.get("X-Content-SHA256")).toBe(asset.sha256Hash);
    expect(success.headers.get("Cache-Control")).toBe("private, no-store");
    expect(success.headers.get("Vary")).toBe("Cookie");
    expect(success.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(new Uint8Array(await success.arrayBuffer())).toEqual(bytes);

    const downloadAudits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.targetId, publishedProductId));
    expect(downloadAudits.some((audit) => audit.action === "product.download_started")).toBe(true);
    expect(downloadAudits.some((audit) => audit.action === "product.downloaded")).toBe(false);

    const noEntitlementInput = request(publishedProductId, otherSessionToken);
    const noEntitlement = await downloadResource(
      noEntitlementInput.request,
      noEntitlementInput.context,
    );
    expect(noEntitlement.status).toBe(403);
    expect(noEntitlement.headers.get("Cache-Control")).toBe("private, no-store");
    expect(noEntitlement.headers.get("Vary")).toBe("Cookie");

    const draftInput = request(draftProductId, sessionToken);
    const draft = await downloadResource(draftInput.request, draftInput.context);
    expect(draft.status).toBe(404);

    const noBuildInput = request(noBuildProductId, sessionToken);
    const noBuild = await downloadResource(noBuildInput.request, noBuildInput.context);
    expect(noBuild.status).toBe(404);
    expect(await noBuild.json()).toEqual({
      error: "No published build is available",
    });
  });

  afterAll(async () => {
    if (storageKey) {
      await storageService.deleteAsset(storageKey);
    }
  });
});
