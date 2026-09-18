import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public product listing hardening", () => {
  it("bounds and caches the free public catalog", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/route.ts"),
      "utf8"
    );
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/product-service.ts"),
      "utf8"
    );

    expect(route).toContain("Math.min(Math.max(Math.floor(requestedLimit), 1), 100)");
    expect(route).toContain("stale-while-revalidate=120");
    expect(route).toContain("limit,");
    expect(service).toContain("limit?: number");
    expect(service).toContain("limit: filters.limit");
  });
});
