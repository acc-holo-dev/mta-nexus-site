import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public product listing hardening", () => {
  it("bounds the free public catalog and prevents caching", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/route.ts"),
      "utf8",
    );
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/product-service.ts"),
      "utf8",
    );

    expect(route).toMatch(
      /Math\.min\(\s*Math\.max\(\s*Math\.floor\(requestedLimit\),\s*1,?\s*\),\s*100,?\s*\)/u,
    );
    expect(route).toMatch(/const publicHeaders = \{\s*"Cache-Control": "no-store"/u);
    expect(route).toContain("pageSize: limit,");
    expect(service).toContain("limit?: number");
    expect(service).toContain("limit: filters.limit");
  });
});
