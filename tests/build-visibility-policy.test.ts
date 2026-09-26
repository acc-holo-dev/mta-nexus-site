import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("resource build visibility", () => {
  it("shows only published builds publicly and keeps lifecycle details to managers/admins", () => {
    const repository = read(
      "packages/db/src/repositories/builds.ts",
    );
    const service = read(
      "apps/web/src/lib/services/product-service.ts",
    );
    const page = read(
      "apps/web/src/app/market/[slug]/page.tsx",
    );

    expect(repository).toContain("listPublishedByProduct");
    expect(service).toContain("includeNonPublic = false");
    expect(service).toContain(
      "buildRepository.listPublishedByProduct",
    );
    expect(service).toContain('product.status === "published"');
    expect(service).toContain("getProductPreviewBySlug");
    expect(service).toContain(
      'can(actor, "product.update", product',
    );

    expect(page).toContain(
      "await productService.canManageProduct(product, user)",
    );
    expect(page).toContain(
      "const canInspectBuilds = canManageProduct || isAdmin;",
    );
    expect(page).toContain(
      "productService.getProductBuilds(product.id, canInspectBuilds)",
    );
    expect(page).toContain("copy.privatePreview");
    expect(page).toContain("const hasAccess =");
    expect(page).toContain("isPublished &&");
  });
});
