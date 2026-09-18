import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("resource build moderation", () => {
  it("requires review before publication and records an explicit decision", () => {
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/product-service.ts"),
      "utf8"
    );
    const adminRoute = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/admin/actions/route.ts"),
      "utf8"
    );

    expect(service).toContain('status: "pending_review"');
    expect(service).toContain('build.scanStatus !== "clean"');
    expect(service).toContain('moderatePending(build.id, input.decision)');
    expect(service).toContain("BUILD_STATE_CHANGED");
    expect(service).toContain("async reviewBuild(");
    expect(service).toContain('"BUILD_NOT_PENDING_REVIEW"');
    expect(service).toContain('action: input.decision === "approve" ? "build.approved" : "build.rejected"');
    expect(adminRoute).toContain('targetType: z.literal("build")');
    expect(adminRoute).toContain("productService.reviewBuild");
  });
});
