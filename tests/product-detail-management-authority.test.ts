import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("product detail management authority", () => {
  it("uses canonical product management instead of historical author attribution", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/market/[slug]/page.tsx"),
      "utf8",
    );

    expect(page).toContain("productService.canManageProduct(product, user)");
    expect(page).toContain("const canInspectBuilds = canManageProduct || isAdmin");
    expect(page).not.toContain("product.authorId === user.id");
  });
});
