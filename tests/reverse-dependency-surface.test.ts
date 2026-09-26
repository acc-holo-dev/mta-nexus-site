import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("reverse dependency surface", () => {
  it("uses one bounded PostgreSQL JSONB containment query", () => {
    const repository = read(
      "packages/db/src/repositories/products.ts",
    );

    expect(repository).toContain("listPublishedFreeDependingOnSlug");
    expect(repository).toContain("->'dependencies'");
    expect(repository).toContain("@>");
    expect(repository).toContain('eq(products.status, "published")');
    expect(repository).toContain("eq(products.price, 0)");
    expect(repository).toContain("ne(products.slug, normalized)");
    expect(repository).toContain(".limit(boundedLimit)");
  });

  it("loads reverse dependencies in the existing product-detail parallel read group", () => {
    const page = read("apps/web/src/app/market/[slug]/page.tsx");

    expect(page).toContain("reverseDependencySummary");
    expect(page).toContain(
      "productService.getReverseDependencySummary(product.slug)",
    );
    expect(page).toContain("<ReverseDependencyList");
    expect(page).toContain("locale={locale}");
  });

  it("does not present direct dependency declarations as compatibility proof", () => {
    const component = read(
      "apps/web/src/components/reverse-dependency-list.tsx",
    );

    expect(component).toContain("getDictionary(locale).dependencyUi");
    expect(component).toContain("copy.reverseNotice");
    expect(component).not.toContain("compatible with");
  });
});
