import { describe, it, expect } from "vitest";
import {
  createServerSchema,
  createProductSchema,
  checkoutSchema,
  changePasswordSchema,
  notificationPreferencesSchema,
} from "@nexus/validation";

describe("Validation Schemas", () => {
  it("should validate server creation data", () => {
    const validServer = {
      name: "San Andreas Touge Club",
      slug: "sa-touge-club",
      ipAddress: "127.0.0.1",
      port: 22003,
      httpPort: 22005,
      maxPlayers: 128,
    };

    const result = createServerSchema.safeParse(validServer);
    expect(result.success).toBe(true);
  });

  it("should reject product with negative price", () => {
    const invalidProduct = {
      title: "Broken Product",
      slug: "broken-product",
      description: "Invalid negative price resource",
      type: "script",
      price: -500,
      licenseModel: "single_server",
    };

    const result = createProductSchema.safeParse(invalidProduct);
    expect(result.success).toBe(false);
  });

  it("should validate resource compatibility and reject duplicate dependencies", () => {
    const base = {
      title: "Compatible Resource",
      slug: "compatible-resource",
      description: "A resource with an explicit MTA compatibility manifest",
      type: "script",
      price: 0,
      licenseModel: "unlimited",
    };

    expect(createProductSchema.safeParse({
      ...base,
      compatibility: { mtaMinVersion: "1.6.0", dependencies: ["core-ui", "vehicle-pack"] },
    }).success).toBe(true);

    expect(createProductSchema.safeParse({
      ...base,
      compatibility: { mtaMinVersion: "latest", dependencies: ["core-ui"] },
    }).success).toBe(false);

    expect(createProductSchema.safeParse({
      ...base,
      compatibility: { dependencies: ["core-ui", "core-ui"] },
    }).success).toBe(false);
  });

  it("should reject password reuse and accept a strong replacement", () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: "old-password",
      newPassword: "new-password",
    }).success).toBe(true);

    expect(changePasswordSchema.safeParse({
      currentPassword: "same-password",
      newPassword: "same-password",
    }).success).toBe(false);
  });

  it("should validate partial notification preference updates", () => {
    expect(notificationPreferencesSchema.safeParse({ followsEnabled: false }).success).toBe(true);
    expect(notificationPreferencesSchema.safeParse({ followsEnabled: "false" }).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({}).success).toBe(false);
  });

  it("should require at least one item for checkout", () => {
    const emptyCheckout = {
      items: [],
      paymentProvider: "mock",
    };

    const result = checkoutSchema.safeParse(emptyCheckout);
    expect(result.success).toBe(false);
  });
});
