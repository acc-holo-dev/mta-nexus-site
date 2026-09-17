import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("build review continuity", () => {
  it("keeps the latest approved release public while a newer build is reviewed", () => {
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/product-service.ts"),
      "utf8"
    );

    expect(service).toContain("const hasPublishedBuild");
    expect(service).toContain("if (!hasPublishedBuild)");
    expect(service).toContain('status: "pending_review"');
  });
});
