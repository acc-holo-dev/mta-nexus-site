import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("closed beta commerce guard", () => {
  it("keeps paid checkout explicitly disabled", () => {
    const route = readFileSync(
      path.resolve(
        process.cwd(),
        "apps/web/src/app/api/checkout/route.ts",
      ),
      "utf8",
    );

    expect(route).toContain("CHECKOUT_DISABLED");
    expect(route).toContain("{ status: 503 }");
    expect(route).not.toContain("createOrderAndCheckout");
  });

  it("keeps paid commerce primitives out of the active resource access service", () => {
    const service = readFileSync(
      path.resolve(
        process.cwd(),
        "apps/web/src/lib/services/commerce-service.ts",
      ),
      "utf8",
    );

    expect(service).toContain("entitlementRepository.claimFreeResource");
    expect(service).toContain("entitlementRepository.hasEntitlement");
    expect(service).not.toContain("licenseRepository");
    expect(service).not.toContain("createOrderAndCheckout");
    expect(service).not.toContain("verifyLicense");
    expect(service).not.toContain("getUserLicenses");
  });

  it("keeps disabled commerce history out of active admin metrics", () => {
    const service = readFileSync(
      path.resolve(
        process.cwd(),
        "apps/web/src/lib/services/admin-service.ts",
      ),
      "utf8",
    );
    const page = readFileSync(
      path.resolve(process.cwd(), "apps/web/src/app/admin/page.tsx"),
      "utf8",
    );

    expect(service).toContain("publishedContent: content.length");
    expect(service).not.toContain("licenseRepository");
    expect(service).not.toContain("orderRepository");
    expect(page).toContain("health.counts.publishedContent");
    expect(page).not.toContain("health.counts.licenses");
    expect(page).not.toContain("health.counts.orders");
  });
});
