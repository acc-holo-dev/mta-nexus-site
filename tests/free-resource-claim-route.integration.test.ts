import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  entitlementRepository,
  productRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { POST } from "../apps/web/src/app/api/resources/claim/route";

function claimRequest(
  productId: string,
  token?: string,
  requestId = "default",
) {
  return new NextRequest(
    "http://nexus.test/api/resources/claim",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `198.51.100.${requestId.length + 10}`,
        ...(token ? { cookie: `nexus_session=${token}` } : {}),
      },
      body: JSON.stringify({ productId }),
    },
  );
}

describe("free resource claim route integration", () => {
  it("returns 201, then 200 idempotently, and refuses later unpublished claims", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const authorId = `usr_claim_http_author_${suffix}`;
    const userId = `usr_claim_http_${suffix}`;
    const productId = `prd_claim_http_${suffix}`;
    const token = `tok_claim_http_${suffix}`;

    await userRepository.create({
      id: authorId,
      email: `claim_http_author_${suffix}@nexus.test`,
      username: `claim_http_author_${suffix}`,
      displayName: "Claim HTTP Author",
      role: "developer",
    });
    await userRepository.create({
      id: userId,
      email: `claim_http_${suffix}@nexus.test`,
      username: `claim_http_${suffix}`,
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
      title: "Claim HTTP Integration Resource",
      slug: `claim-http-${suffix}`,
      description: "Resource used to prove HTTP claim semantics.",
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

    const first = await POST(claimRequest(productId, token, "first"));
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody).toMatchObject({
      alreadyClaimed: false,
      entitlement: {
        subjectId: userId,
        resourceId: productId,
        permission: "product.download",
      },
    });

    const retry = await POST(claimRequest(productId, token, "retry"));
    expect(retry.status).toBe(200);
    const retryBody = await retry.json();
    expect(retryBody).toMatchObject({
      alreadyClaimed: true,
      entitlement: {
        id: firstBody.entitlement.id,
        resourceId: productId,
      },
    });

    const productAfterRetry = await productRepository.findById(productId);
    expect(productAfterRetry?.salesCount).toBe(1);
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: userId },
        productId,
        "product.download",
      ),
    ).toBe(true);

    await productRepository.update(productId, { status: "draft" });

    const unpublished = await POST(
      claimRequest(productId, token, "draft"),
    );
    expect(unpublished.status).toBe(404);

    const anonymous = await POST(
      claimRequest(productId, undefined, "anonymous"),
    );
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({
      error: "Authentication required",
    });
  });
});
