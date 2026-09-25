import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("public resource availability", () => {
  it("filters public catalog queries by safe published build availability", () => {
    const repository = read("packages/db/src/repositories/products.ts");

    expect(repository).toContain("function hasSafePublishedBuild()");
    expect(repository).toContain("and btrim(");
    expect(repository).toContain("hasSafePublishedBuild(),");

    const list = repository.slice(
      repository.indexOf("async list("),
      repository.indexOf("async listPublishedByOrganization("),
    );
    expect(list).toContain('eq(products.status, "published")');
    expect(list).toContain("hasSafePublishedBuild()");
  });

  it("requires a safe build for public product detail resolution", () => {
    const service = read("apps/web/src/lib/services/product-service.ts");

    const bySlug = service.slice(
      service.indexOf("async getProductBySlug("),
      service.indexOf("async getProductPreviewBySlug("),
    );
    const byId = service.slice(
      service.indexOf("async getProductById("),
      service.indexOf("async getProductBuilds("),
    );

    expect(bySlug).toContain(
      "buildRepository.findLatestPublishedByProduct(product.id)",
    );
    expect(byId).toContain(
      "buildRepository.findLatestPublishedByProduct(product.id)",
    );
  });
});
