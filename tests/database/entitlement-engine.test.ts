import { describe, it, expect, beforeAll } from "vitest";
import {
  entitlementRepository,
  licenseRepository,
  userRepository,
  productRepository,
} from "@nexus/db";

describe("Entitlement Engine hasEntitlement()", () => {
  const timestamp = Date.now().toString(36);
  const userId = `usr_ent_${timestamp}`;
  const productId = `prd_ent_${timestamp}`;

  beforeAll(async () => {
    await userRepository.create({
      id: userId,
      email: `ent_${timestamp}@nexus.test`,
      username: `ent_${timestamp}`,
      displayName: "Entitlement Tester",
      role: "user",
    });

    await productRepository.create({
      id: productId,
      title: "Entitlement Test Resource",
      slug: `ent-test-${timestamp}`,
      description: "Testing entitlement engine access",
      type: "script",
      status: "published",
      authorId: userId,
      price: 1000,
      currency: "USD",
      licenseModel: "single_server",
      tags: ["test"],
      currentVersion: "1.0.0",
      ratingAverage: 50,
      ratingCount: 1,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: {},
    });
  });

  it("should return false when no entitlement or license exists", async () => {
    const has = await entitlementRepository.hasEntitlement(
      { type: "user", id: userId },
      productId,
      "product.download",
    );
    expect(has).toBe(false);
  });

  it("should return true when direct entitlement is granted", async () => {
    await entitlementRepository.create({
      id: `ent_${Date.now()}`,
      subjectType: "user",
      subjectId: userId,
      permission: "module.runtime",
      resourceId: productId,
    });

    const has = await entitlementRepository.hasEntitlement(
      { type: "user", id: userId },
      productId,
      "module.runtime",
    );
    expect(has).toBe(true);
  });

  it("should return true for download when an active license exists", async () => {
    await licenseRepository.create({
      id: `lic_${Date.now()}`,
      key: `NX-ENT-${Date.now().toString(36).toUpperCase()}`,
      productId,
      userId,
      model: "single_server",
      status: "active",
      entitlements: ["server.run", "updates.download"],
    });

    const has = await entitlementRepository.hasEntitlement(
      { type: "user", id: userId },
      productId,
      "product.download",
    );
    expect(has).toBe(true);
  });
  it("checks all active licenses for an explicit permission while denying expired or revoked grants", async () => {
    const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const requesterId = `usr_ent_multi_${suffix}`;
    await userRepository.create({
      id: requesterId,
      email: `ent_multi_${suffix}@nexus.test`,
      username: `ent_multi_${suffix}`,
      displayName: "Multiple License Tester",
      role: "user",
    });
    const buildLicense = (
      name: string,
      status: "active" | "revoked",
      entitlements: string[],
      expiresAt?: Date,
    ) =>
      licenseRepository.create({
        id: `lic_multi_${name}_${suffix}`,
        key: `NX-MULTI-${name.toUpperCase()}-${suffix.toUpperCase()}`,
        productId,
        userId: requesterId,
        model: "single_server",
        status,
        entitlements,
        ...(expiresAt ? { expiresAt } : {}),
      });

    await buildLicense("first", "active", ["server.run"]);
    await buildLicense("expired", "active", ["module.download"], new Date(Date.now() - 60_000));
    await buildLicense("revoked", "revoked", ["module.download"]);
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: requesterId },
        productId,
        "module.download",
      ),
    ).toBe(false);
    await buildLicense("second", "active", ["module.download"]);
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: requesterId },
        productId,
        "module.download",
      ),
    ).toBe(true);
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: requesterId },
        productId,
        "different.permission",
      ),
    ).toBe(false);
  });
});
