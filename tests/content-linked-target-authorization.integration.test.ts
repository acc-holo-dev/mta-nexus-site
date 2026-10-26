import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
import {
  productRepository,
  serverRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { POST } from "../apps/web/src/app/api/content/route";

function contentRequest(token: string, body: Record<string, unknown>) {
  return new NextRequest("http://nexus.test/api/content", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: `nexus_session=${token}`,
    },
    body: JSON.stringify(body),
  });
}

describe("linked content target authorization integration", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("rejects foreign server/resource links and accepts the real owner", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    // Slugs only allow [a-z0-9-], so derive a slug-safe variant for URL fields.
    const slugSuffix = suffix.replace(/[^a-z0-9-]/g, "-");
    const ownerId = `usr_link_owner_${suffix}`;
    const attackerId = `usr_link_attacker_${suffix}`;
    const serverId = `srv_link_${suffix}`;
    const productId = `prd_link_${suffix}`;
    const ownerToken = `tok_link_owner_${suffix}`;
    const attackerToken = `tok_link_attacker_${suffix}`;
    const port = 10_000 + ((Date.now() + process.pid) % 40_000);

    await userRepository.create({
      id: ownerId,
      email: `link_owner_${suffix}@nexus.test`,
      username: `link_owner_${suffix}`,
      displayName: "Linked Target Owner",
      role: "developer",
    });
    await userRepository.create({
      id: attackerId,
      email: `link_attacker_${suffix}@nexus.test`,
      username: `link_attacker_${suffix}`,
      displayName: "Linked Target Attacker",
      role: "user",
    });
    await sessionRepository.create({
      id: `ses_link_owner_${suffix}`,
      userId: ownerId,
      token: ownerToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await sessionRepository.create({
      id: `ses_link_attacker_${suffix}`,
      userId: attackerId,
      token: attackerToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await serverRepository.create({
      id: serverId,
      name: "Linked Target Server",
      slug: `linked-target-server-${suffix}`,
      ipAddress: "198.51.100.150",
      port,
      ownerId,
      status: "active",
      visibility: "public",
      isVerified: false,
      gameplayTags: [],
      mediaUrls: [],
    });

    await productRepository.create({
      id: productId,
      title: "Linked Target Resource",
      slug: `linked-target-resource-${suffix}`,
      description: "Resource used to prove linked-content authorization.",
      type: "script",
      status: "published",
      authorId: ownerId,
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

    const foreignServer = await POST(
      contentRequest(attackerToken, {
        title: "Foreign server association",
        slug: `foreign-server-association-${slugSuffix}`,
        body: "This body is long enough for content validation.",
        type: "post",
        serverId,
      }),
    );
    expect(foreignServer.status).toBe(403);
    expect(await foreignServer.json()).toEqual({
      error: "You do not manage the linked server",
    });

    const foreignProduct = await POST(
      contentRequest(attackerToken, {
        title: "Foreign resource association",
        slug: `foreign-resource-association-${slugSuffix}`,
        body: "This body is long enough for content validation.",
        type: "post",
        productId,
      }),
    );
    expect(foreignProduct.status).toBe(403);
    expect(await foreignProduct.json()).toEqual({
      error: "You do not manage the linked resource",
    });

    const owned = await POST(
      contentRequest(ownerToken, {
        title: "Owned linked publication",
        slug: `owned-linked-publication-${slugSuffix}`,
        body: "This body is long enough for content validation.",
        type: "post",
        serverId,
        productId,
      }),
    );
    expect(owned.status).toBe(201);
    expect(await owned.json()).toMatchObject({
      content: {
        authorId: ownerId,
        serverId,
        productId,
        status: "published",
      },
    });
  });
});
