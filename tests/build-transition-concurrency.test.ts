import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("build state transition concurrency", () => {
  it("uses a compare-and-set update for moderation and retirement", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/builds.ts"),
      "utf8"
    );
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/product-service.ts"),
      "utf8"
    );

    expect(repository).toContain("expectedStatus?: Build");
    expect(repository).toContain("eq(builds.status, expectedStatus)");
    expect(service).toContain('updateStatus(build.id, status, "pending_review")');
    expect(service).toContain('updateStatus(build.id, "retired", build.status)');
  });
});
