import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("resource dependency resolution surface", () => {
  it("resolves dependencies in one bounded public-free repository query", () => {
    const repository = read(
      "packages/db/src/repositories/products.ts",
    );

    expect(repository).toContain("findPublishedFreeBySlugs");
    expect(repository).toContain("inArray(products.slug, normalized)");
    expect(repository).toContain('eq(products.status, "published")');
    expect(repository).toContain("eq(products.price, 0)");
    expect(repository).toContain(".slice(0, 25)");
    expect(repository).toContain(".limit(25)");
  });

  it("loads builds, reviews and dependency reads in one parallel group", () => {
    const page = read("apps/web/src/app/market/[slug]/page.tsx");

    expect(page).toContain("await Promise.all([");
    expect(page).toContain(
      "productService.getDependencyResolution(product).catch(() => null)",
    );
    expect(page).toContain("<ProductDependencyList");
    expect(page).toContain("locale={locale}");
  });

  it("labels unresolved dependencies without claiming incompatibility", () => {
    const component = read(
      "apps/web/src/components/product-dependency-list.tsx",
    );

    expect(component).toContain("getDictionary(locale).dependencyUi");
    expect(component).toContain("copy.notFound");
    expect(component).toContain("copy.selfReference");
    expect(component).toContain("copy.resolutionNotice");
    expect(component).not.toContain("incompatible");
  });
});
