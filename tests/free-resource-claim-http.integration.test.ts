import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  buildRepository,
  entitlementRepository,
  productRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { POST as claimResource } from "../apps/web/src/app/api/resources/claim/route";

describe("free resource claim HTTP integration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 201 on first claim, 200 on retry, and 401 anonymously", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const authorId = `usr_claim_http_author_${suffix}`;
    const userId = `usr_claim_http_user_${suffix}`;
    const token = `tok_claim_http_${suffix}`;
    const productId = `prd_claim_http_${suffix}`;
    const proxySecret = `claim-http-${suffix}-0123456789abcdef0123456789abcdef`;
    const clientIp = `198.51.100.${20 + (process.pid % 200)}`;
    vi.stubEnv("TRUSTED_PROXY_SECRET", proxySecret);

    await userRepository.create({
      id: authorId,
      email: `claim_http_author_${suffix}@nexus.test`,
      username: `claim_http_author_${suffix}`,
      displayName: "Claim HTTP Author",
      role: "developer",
    });
    await userRepository.create({
      id: userId,
      email: `claim_http_user_${suffix}@nexus.test`,
      username: `claim_http_user_${suffix}`,
      displayName: "Claim HTTP User",
      role: "user",
    });
    await sessionRepository.create({
      id: `ses_claim_http_${suffix}`,
      userId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await productRepository.create({
      id: productId,
      title: "HTTP Claim Resource",
      slug: `http-claim-resource-${suffix}`,
      description: "Route-level free claim integration resource.",
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

    await buildRepository.create({
      id: `bld_claim_safe_${suffix}`,
      productId: productId,
      version: "1.0.0",
      status: "published",
      storageKey: `assets/test/claim-safe-${suffix}.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 16,
      fileName: "claim-safe.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      isSigned: false,
    });

    const makeRequest = (session?: string) =>
      new NextRequest("http://nexus.test/api/resources/claim", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nexus-proxy-secret": proxySecret,
          "x-real-ip": clientIp,
          ...(session
            ? { cookie: `nexus_session=${session}` }
            : {}),
        },
        body: JSON.stringify({ productId }),
      });

    const first = await claimResource(makeRequest(token));
    expect(first.status).toBe(201);
    expect(first.headers.get("Cache-Control")).toBe("private, no-store");
    expect(first.headers.get("Vary")).toBe("Cookie");
    const firstBody = await first.json();
    expect(firstBody).toMatchObject({
      alreadyClaimed: false,
      entitlement: {
        subjectId: userId,
        resourceId: productId,
        permission: "product.download",
      },
    });

    const retry = await claimResource(makeRequest(token));
    expect(retry.status).toBe(200);
    expect(retry.headers.get("Cache-Control")).toBe("private, no-store");
    expect(retry.headers.get("Vary")).toBe("Cookie");
    const retryBody = await retry.json();
    expect(retryBody).toMatchObject({
      alreadyClaimed: true,
      entitlement: {
        id: firstBody.entitlement.id,
        subjectId: userId,
        resourceId: productId,
      },
    });

    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: userId },
        productId,
        "product.download",
      ),
    ).toBe(true);

    const product = await productRepository.findById(productId);
    expect(product?.salesCount).toBe(1);

    const anonymous = await claimResource(makeRequest());
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get("Cache-Control")).toBe("private, no-store");
    expect(anonymous.headers.get("Vary")).toBe("Cookie");
    expect(await anonymous.json()).toEqual({
      error: "Authentication required",
    });

    const malformedAnonymous = await claimResource(
      new NextRequest("http://nexus.test/api/resources/claim", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nexus-proxy-secret": proxySecret,
          "x-real-ip": clientIp,
        },
        body: "{not-valid-json",
      }),
    );
    expect(malformedAnonymous.status).toBe(401);
    expect(await malformedAnonymous.json()).toEqual({
      error: "Authentication required",
    });
  });
});
