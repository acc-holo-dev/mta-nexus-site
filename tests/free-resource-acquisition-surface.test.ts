import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("free resource acquisition surface", () => {
  it("uses a dedicated acquisition route and the free claim endpoint", () => {
    const page = read("apps/web/src/app/acquire/page.tsx");
    const legacy = read("apps/web/src/app/checkout/page.tsx");

    expect(page).toContain('fetch("/api/resources/claim"');
    expect(page).not.toContain('fetch("/api/checkout"');
    expect(page).toContain("copy.addToLibrary");
    expect(page).toContain('credentials: "same-origin"');
    expect(page).toContain('cache: "no-store"');

    expect(legacy).toContain('redirect(');
    expect(legacy).toContain('/acquire?productId=');
    expect(legacy).not.toContain("/api/resources/claim");
  });

  it("returns users directly to the resource or library after a successful claim", () => {
    const page = read("apps/web/src/app/acquire/page.tsx");

    const dollar = "$";
    expect(page).toContain(`href={\`/market/${dollar}{product?.slug ?? ""}\`}`);
    expect(page).toContain('href="/workspace"');
    expect(page).toContain("copy.openLibrary");
    expect(page).not.toContain("Go to My Licenses");
  });

  it("keeps claim transaction serialized and increments the library count once", () => {
    const repository = read(
      "packages/db/src/repositories/entitlements.ts",
    );

    expect(repository).toContain("pg_advisory_xact_lock");
    expect(repository).toContain("free-resource:");
    expect(repository).toContain(
      'eq(entitlements.permission, "product.download")',
    );
    const dollar = "$";
    expect(repository).toContain(
      `salesCount: sql\`${dollar}{products.salesCount} + 1\``,
    );
  });
});
