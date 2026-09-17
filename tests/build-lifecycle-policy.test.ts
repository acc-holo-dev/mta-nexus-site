import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("resource build lifecycle", () => {
  it("supports authorized retirement and removes the final release from public delivery", () => {
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/product-service.ts"),
      "utf8"
    );
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/builds/[buildId]/route.ts"),
      "utf8"
    );

    expect(service).toContain('async retireBuild(');
    expect(service).toContain('status: "retired"');
    expect(service).toContain('{ status: "draft" }');
    expect(service).toContain('action: "build.retired"');
    expect(route).toContain('action: z.literal("retire")');
    expect(route).toContain("productService.retireBuild");
  });
});
