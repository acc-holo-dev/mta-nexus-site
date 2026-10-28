import { describe, it, expect } from "vitest";
import {
  createServerSchema,
  createOrganizationSchema,
  updateServerSchema,
  safeExternalWebUrl,
  createProductSchema,
  createBuildSchema,
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

    expect(
      createProductSchema.safeParse({
        ...base,
        compatibility: { mtaMinVersion: "1.6.0", dependencies: ["core-ui", "vehicle-pack"] },
      }).success,
    ).toBe(true);

    expect(
      createProductSchema.safeParse({
        ...base,
        compatibility: { mtaMinVersion: "1.6.0-9.22279.0", dependencies: [] },
      }).success,
    ).toBe(true);

    expect(
      createProductSchema.safeParse({
        ...base,
        compatibility: { mtaMinVersion: "latest", dependencies: ["core-ui"] },
      }).success,
    ).toBe(false);

    expect(
      createProductSchema.safeParse({
        ...base,
        compatibility: { mtaMinVersion: "1.6.0-preview", dependencies: [] },
      }).success,
    ).toBe(false);

    expect(
      createProductSchema.safeParse({
        ...base,
        compatibility: { dependencies: ["core-ui", "core-ui"] },
      }).success,
    ).toBe(false);
  });

  it("accepts sortable MTA release targets for resource and build metadata", () => {
    const target = "1.6.0-9.22279.0";
    expect(
      createProductSchema.safeParse({
        title: "Sortable MTA Resource",
        slug: "sortable-mta-resource",
        description: "A resource using an exact MTA sortable release target",
        type: "script",
        price: 0,
        licenseModel: "unlimited",
        compatibility: { mtaMinVersion: target },
      }).success,
    ).toBe(true);

    expect(
      createBuildSchema.safeParse({
        productId: "prd_sortable",
        version: "1.0.0",
        storageKey: "builds/sortable.zip",
        sha256Hash: "a".repeat(64),
        fileSizeBytes: 1,
        mtaVersionTarget: target,
      }).success,
    ).toBe(true);

    expect(
      createBuildSchema.safeParse({
        productId: "prd_sortable",
        version: "1.0.0",
        storageKey: "builds/sortable.zip",
        sha256Hash: "a".repeat(64),
        fileSizeBytes: 1,
        mtaVersionTarget: "1.6.0-preview",
      }).success,
    ).toBe(false);
  });

  it("should reject password reuse and accept a strong replacement", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old-password",
        newPassword: "new-password",
      }).success,
    ).toBe(true);

    expect(
      changePasswordSchema.safeParse({
        currentPassword: "same-password",
        newPassword: "same-password",
      }).success,
    ).toBe(false);
  });

  it("should validate partial notification preference updates", () => {
    expect(notificationPreferencesSchema.safeParse({ followsEnabled: false }).success).toBe(true);
    expect(notificationPreferencesSchema.safeParse({ followsEnabled: "false" }).success).toBe(
      false,
    );
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

describe("public external website links", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/a",
    "ftp://example.com",
    "//example.com",
    "https://user:pass@example.com",
    "https://example.com/\nfoo",
    " https://example.com",
    `https://example.com/${"x".repeat(2048)}`,
  ])("rejects unsafe URL %s at create/update boundaries", (url) => {
    expect(safeExternalWebUrl(url)).toBeUndefined();
    expect(
      createOrganizationSchema.safeParse({ name: "Team", slug: "team", websiteUrl: url }).success,
    ).toBe(false);
    for (const field of ["websiteUrl", "discordUrl", "rulesUrl"]) {
      expect(updateServerSchema.safeParse({ [field]: url }).success).toBe(false);
    }
    expect(updateServerSchema.safeParse({ mediaUrls: [url] }).success).toBe(false);
  });
  it.each([
    "https://example.com/path?q=a%20b#section",
    "http://localhost:3000",
    "https://пример.рф",
    "HTTPS://EXAMPLE.COM",
  ])("accepts HTTP(S) URL %s", (url) => {
    expect(safeExternalWebUrl(url)).toBe(new URL(url).href);
    expect(
      createOrganizationSchema.safeParse({ name: "Team", slug: "team", websiteUrl: url }).success,
    ).toBe(true);
    expect(
      updateServerSchema.safeParse({
        websiteUrl: url,
        discordUrl: url,
        rulesUrl: url,
        mediaUrls: [url],
      }).success,
    ).toBe(true);
  });
  it("keeps optional links clearable and rejects blank media items", () => {
    expect(
      updateServerSchema.safeParse({ websiteUrl: "", discordUrl: "", rulesUrl: "", mediaUrls: [] })
        .success,
    ).toBe(true);
    expect(updateServerSchema.safeParse({ mediaUrls: [""] }).success).toBe(false);
    expect(safeExternalWebUrl(null)).toBeUndefined();
  });
});
