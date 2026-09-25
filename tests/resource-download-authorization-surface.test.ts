import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("resource download route policy surface", () => {
  it("keeps auth, publication/access, published-build and storage checks ordered fail-closed", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/download/route.ts"),
      "utf8",
    );

    const auth = route.indexOf("if (!user)");
    const product = route.indexOf("productRepository.findById(productId)");
    const policy = route.indexOf("decideResourceDownloadAccess(");
    const latestBuild = route.indexOf(
      "buildRepository.findLatestPublishedByProduct(productId)",
    );
    const storage = route.indexOf("storageService.getDownloadStream");

    expect(auth).toBeGreaterThan(-1);
    expect(product).toBeGreaterThan(auth);
    expect(policy).toBeGreaterThan(product);
    expect(latestBuild).toBeGreaterThan(policy);
    expect(storage).toBeGreaterThan(latestBuild);
  });

  it("does not query entitlement for author or admin fast paths", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/download/route.ts"),
      "utf8",
    );

    expect(route).toContain(
      'product.authorId === user.id || user.role === "admin"',
    );
    expect(route).toContain("const hasEntitlement = isPrivileged");
    expect(route).toContain("? false");
  });

  it("maps unpublished resources to 404 and missing entitlement to 403", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/download/route.ts"),
      "utf8",
    );

    expect(route).toContain('access.reason === "resource_not_published"');
    expect(route).toContain('{ status: 404 }');
    expect(route).toContain('{ status: 403 }');
  });
});
