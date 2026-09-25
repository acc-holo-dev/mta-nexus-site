import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("product review authority", () => {
  it("uses safe public resolution and current management authority", () => {
    const route = readFileSync(
      resolve(
        process.cwd(),
        "apps/web/src/app/api/products/[id]/reviews/route.ts",
      ),
      "utf8",
    );

    expect(route).toContain("productService.getProductById(productId)");
    expect(route).toContain(
      "productService.canManageProduct(product, user)",
    );
    expect(route).not.toContain("product.authorId === user.id");
    expect(route).not.toContain("productRepository.findById(productId)");
  });
});
