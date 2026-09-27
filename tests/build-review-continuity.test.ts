import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("build review continuity", () => {
  it("keeps the latest approved release public while a newer build is reviewed", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/builds.ts"),
      "utf8"
    );

    const safety = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/build-safety.ts"),
      "utf8"
    );

    expect(repository).toContain("safePublishedBuildCondition(data.productId)");
    expect(safety).toContain('eq(builds.status, "published")');
    expect(safety).toContain("trustedCleanScanCondition()");
    expect(repository).toContain("if (!published[0])");
    expect(repository).toContain('status: "pending_review"');
    expect(repository).toContain("db.transaction");
  });
});
