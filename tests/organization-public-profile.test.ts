import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("organization public profile queries", () => {
  it("queries resources and content by organization before applying limits", () => {
    const page = read("apps/web/src/app/organizations/[slug]/page.tsx");

    expect(page).toContain(
      "productRepository.pagePublishedFreeByOrganization(organization.id, parseProfilePage(query?.page), 24)",
    );
    expect(page).toContain(
      "contentRepository.listPublishedByOrganization(organization.id, 100)",
    );
    expect(page).not.toContain("productRepository.list()");
    expect(page).not.toContain("contentRepository.listPublished()");
    expect(page).not.toContain(".filter((p) => p.organizationId === organization.id)");
  });

  it("keeps public organization repositories status-scoped and bounded", () => {
    const products = read("packages/db/src/repositories/products.ts");
    const content = read("packages/db/src/repositories/content.ts");

    expect(products).toContain("listPublishedByOrganization(");
    expect(products).toContain("eq(products.organizationId, organizationId)");
    expect(products).toContain('eq(products.status, "published")');
    expect(products).toContain("eq(products.price, 0)");
    expect(products).toContain(".limit(boundedLimit)");

    expect(content).toContain("listPublishedByOrganization(");
    expect(content).toContain("eq(content.organizationId, organizationId)");
    expect(content).toContain('eq(content.status, "published")');
    expect(content).toContain(".limit(boundedLimit)");
  });
});
