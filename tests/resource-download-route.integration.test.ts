import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  buildRepository,
  entitlementRepository,
  productRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { storageService } from "@nexus/storage";
import { GET } from "../apps/web/src/app/api/products/[id]/download/route";

function downloadRequest(token: string, productId: string) {
  return new NextRequest(`http://nexus.test/api/products/${productId}/download`, {
    method: "GET",
    headers: {
      cookie: `nexus_session=${token}`,
    },
  });
}

describe("resource download route integration", () => {
  it("enforces entitlement, publication and published-build gates around real bytes", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const authorId = `usr_dl_author_${suffix}`;
    const entitledUserId = `usr_dl_entitled_${suffix}`;
    const otherUserId = `usr_dl_other_${suffix}`;
    const productId = `prd_dl_${suffix}`;
    const buildId = `bld_dl_${suffix}`;
    const entitledToken = `tok_entitled_${suffix}`;
    const otherToken = `tok_other_${suffix}`;
    const bytes = Buffer.from("nexus-download-integration");

    await userRepository.create({
      id: authorId,
      email: `dl_author_${suffix}@nexus.test`,
      username: `dl_author_${suffix}`,
      displayName: "Download Author",
      role: "developer",
    });
    await userRepository.create({
      id: entitledUserId,
      email: `dl_entitled_${suffix}@nexus.test`,
      username: `dl_entitled_${suffix}`,
      displayName: "Entitled User",
      role: "user",
    });
    await userRepository.create({
      id: otherUserId,
      email: `dl_other_${suffix}@nexus.test`,
      username: `dl_other_${suffix}`,
      displayName: "Other User",
      role: "user",
    });

    await sessionRepository.create({
      id: `ses_entitled_${suffix}`,
      userId: entitledUserId,
      token: entitledToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await sessionRepository.create({
      id: `ses_other_${suffix}`,
      userId: otherUserId,
      token: otherToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await productRepository.create({
      id: productId,
      title: "Download Integration Resource",
      slug: `download-integration-${suffix}`,
      description: "Resource used to prove route-level download authorization.",
      type: "script",
      status: "published",
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

    await entitlementRepository.create({
      id: `ent_dl_${suffix}`,
      subjectType: "user",
      subjectId: entitledUserId,
      permission: "product.download",
      resourceId: productId,
    });

    const asset = await storageService.uploadAsset({
      data: bytes,
      fileName: "download-integration.zip",
      mimeType: "application/zip",
      userId: authorId,
      isPrivate: true,
    });

    await buildRepository.create({
      id: buildId,
      productId,
      version: "1.0.0",
      releaseNotes: "download integration",
      storageKey: asset.key,
      sha256Hash: asset.sha256Hash,
      fileSizeBytes: asset.sizeBytes,
      fileName: "download-integration.zip",
      mimeType: "application/zip",
      status: "published",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      isSigned: false,
    });

    try {
      const success = await GET(downloadRequest(entitledToken, productId), {
        params: Promise.resolve({ id: productId }),
      });
      expect(success.status).toBe(200);
      expect(success.headers.get("X-Content-SHA256")).toBe(asset.sha256Hash);
      expect(success.headers.get("Cache-Control")).toBe("private, no-store");
      expect(success.headers.get("Vary")).toBe("Cookie");
      expect(Buffer.from(await success.arrayBuffer())).toEqual(bytes);

      const denied = await GET(downloadRequest(otherToken, productId), {
        params: Promise.resolve({ id: productId }),
      });
      expect(denied.status).toBe(403);
      expect(await denied.json()).toEqual({
        error: "Add this resource to your library before downloading it",
      });

      await productRepository.update(productId, { status: "draft" });
      const unpublished = await GET(downloadRequest(entitledToken, productId), {
        params: Promise.resolve({ id: productId }),
      });
      expect(unpublished.status).toBe(404);
      expect(await unpublished.json()).toEqual({
        error: "Resource not found",
      });

      await productRepository.update(productId, { status: "published" });
      await buildRepository.updateStatus(buildId, "retired", "published");
      const retired = await GET(downloadRequest(entitledToken, productId), {
        params: Promise.resolve({ id: productId }),
      });
      expect(retired.status).toBe(404);
      expect(await retired.json()).toEqual({
        error: "No published build is available",
      });
    } finally {
      await storageService.deleteAsset(asset.key);
    }
  });
});
