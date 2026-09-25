import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("free resource acquisition surface", () => {
  it("uses the free claim endpoint rather than the disabled paid checkout API", () => {
    const page = read("apps/web/src/app/checkout/page.tsx");

    expect(page).toContain('fetch("/api/resources/claim"');
    expect(page).not.toContain('fetch("/api/checkout"');
    expect(page).toContain('"Add to library"');
  });

  it("returns users directly to the resource or resource library after a successful claim", () => {
    const page = read("apps/web/src/app/checkout/page.tsx");

    expect(page).toContain('href={`/market/${product?.slug ?? ""}`}');
    expect(page).toContain('href="/workspace"');
    expect(page).toContain("Open resource library");
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
    expect(repository).toContain(
      "salesCount: sql`${products.salesCount} + 1`",
    );
  });
});
