import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("closed beta product policy", () => {
  it("enforces free-only resources below the HTTP layer", () => {
    const service = readFileSync(
      path.resolve(process.cwd(), "apps/web/src/lib/services/product-service.ts"),
      "utf8"
    );

    expect(service).toContain("PAID_RESOURCES_DISABLED");
    expect(service).toContain("input.price !== 0");
    expect(service).toContain("minPrice: 0");
    expect(service).toContain("maxPrice: 0");
    expect(service).toContain("product?.price === 0 ? product : null");
  });

  it("removes price sorting and paid checkout language from the public library", () => {
    const market = readFileSync(path.resolve(process.cwd(), "apps/web/src/app/market/page.tsx"), "utf8");
    const card = readFileSync(path.resolve(process.cwd(), "apps/web/src/components/product-card.tsx"), "utf8");

    expect(market).not.toContain('id: "price_asc"');
    expect(market).not.toContain('id: "price_desc"');
    expect(card).toContain('const formattedPrice = "Free"');
  });
});
