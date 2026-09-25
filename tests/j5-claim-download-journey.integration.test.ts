import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  buildRepository,
  productRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { storageService } from "@nexus/storage";
import { POST as claimResource } from "../apps/web/src/app/api/resources/claim/route";
import { GET as downloadResource } from "../apps/web/src/app/api/products/[id]/download/route";

describe("J5 free resource claim-to-download journey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("moves one user from denied download to claimed bytes and fails closed after suspension", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const authorId = `usr_j5_author_${suffix}`;
    const userId = `usr_j5_user_${suffix}`;
    const sessionToken = `tok_j5_${suffix}`;
    const productId = `prd_j5_${suffix}`;
    const buildId = `bld_j5_${suffix}`;
    const proxySecret =
      `j5-${suffix}-0123456789abcdef0123456789abcdef`;
    const clientIp = `198.51.100.${30 + (process.pid % 190)}`;

    vi.stubEnv("TRUSTED_PROXY_SECRET", proxySecret);

    await userRepository.create({
      id: authorId,
      email: `j5_author_${suffix}@nexus.test`,
      username: `j5_author_${suffix}`,
      displayName: "J5 Author",
      role: "developer",
    });
    await userRepository.create({
      id: userId,
      email: `j5_user_${suffix}@nexus.test`,
      username: `j5_user_${suffix}`,
      displayName: "J5 User",
      role: "user",
    });
    await sessionRepository.create({
      id: `ses_j5_${suffix}`,
      userId,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await productRepository.create({
      id: productId,
      title: "J5 Journey Resource",
      slug: `j5-journey-${suffix}`,
      description: "End-to-end free claim and download acceptance resource.",
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

    const bytes = new TextEncoder().encode(
      "nexus-j5-claim-download-journey",
    );
    const asset = await storageService.uploadAsset({
      data: bytes,
      fileName: "j5-resource.zip",
      mimeType: "application/zip",
      userId: authorId,
      isPrivate: true,
    });

    try {
      await buildRepository.create({
        id: buildId,
        productId,
        version: "1.0.0",
        status: "published",
        storageKey: asset.key,
        sha256Hash: asset.sha256Hash,
        fileSizeBytes: asset.sizeBytes,
        fileName: "j5-resource.zip",
        mimeType: "application/zip",
        scanStatus: "clean",
        scanner: "integration-test",
        scannedAt: new Date(),
        isSigned: false,
      });

      const downloadRequest = () =>
        new NextRequest(
          `http://nexus.test/api/products/${productId}/download`,
          {
            method: "GET",
            headers: {
              cookie: `nexus_session=${sessionToken}`,
            },
          },
        );
      const downloadContext = {
        params: Promise.resolve({ id: productId }),
      };
      const claimRequest = () =>
        new NextRequest("http://nexus.test/api/resources/claim", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `nexus_session=${sessionToken}`,
            "x-nexus-proxy-secret": proxySecret,
            "x-real-ip": clientIp,
          },
          body: JSON.stringify({ productId }),
        });

      const beforeClaim = await downloadResource(
        downloadRequest(),
        downloadContext,
      );
      expect(beforeClaim.status).toBe(403);
      expect(beforeClaim.headers.get("Cache-Control")).toBe(
        "private, no-store",
      );
      expect(beforeClaim.headers.get("Vary")).toBe("Cookie");

      const firstClaim = await claimResource(claimRequest());
      expect(firstClaim.status).toBe(201);
      const firstClaimBody = await firstClaim.json();
      expect(firstClaimBody).toMatchObject({
        alreadyClaimed: false,
        entitlement: {
          subjectId: userId,
          resourceId: productId,
          permission: "product.download",
        },
      });

      const afterClaim = await downloadResource(
        downloadRequest(),
        downloadContext,
      );
      expect(afterClaim.status).toBe(200);
      expect(afterClaim.headers.get("X-Content-SHA256")).toBe(
        asset.sha256Hash,
      );
      expect(afterClaim.headers.get("Cache-Control")).toBe(
        "private, no-store",
      );
      expect(afterClaim.headers.get("Vary")).toBe("Cookie");
      expect(
        new Uint8Array(await afterClaim.arrayBuffer()),
      ).toEqual(bytes);

      const retry = await claimResource(claimRequest());
      expect(retry.status).toBe(200);
      const retryBody = await retry.json();
      expect(retryBody).toMatchObject({
        alreadyClaimed: true,
        entitlement: {
          id: firstClaimBody.entitlement.id,
          resourceId: productId,
        },
      });

      const afterRetryProduct =
        await productRepository.findById(productId);
      expect(afterRetryProduct?.salesCount).toBe(1);

      await productRepository.update(productId, {
        status: "suspended",
      });

      const afterSuspension = await downloadResource(
        downloadRequest(),
        downloadContext,
      );
      expect(afterSuspension.status).toBe(404);
      expect(await afterSuspension.json()).toEqual({
        error: "Resource not found",
      });
    } finally {
      await storageService.deleteAsset(asset.key);
    }
  });
});
