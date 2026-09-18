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
    expect(repository).toContain("async moderatePending(");
    expect(repository).toContain('eq(builds.status, "pending_review")');
    expect(repository).toContain("async retireAndRefreshProduct(");
    expect(repository).toContain("db.transaction");
    expect(service).toContain("moderatePending(build.id, input.decision)");
    expect(service).toContain("retireAndRefreshProduct(build.id, build.status)");
  });
});
