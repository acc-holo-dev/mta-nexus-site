import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readBuildsRepositoryModules(): string {
  return ["builds.ts", "builds-queries.ts", "builds-moderation.ts", "builds-lifecycle.ts"]
    .map((name) =>
      readFileSync(resolve(process.cwd(), "packages/db/src/repositories", name), "utf8"),
    )
    .join("\n");
}

describe("build state transition concurrency", () => {
  it("uses a compare-and-set update for moderation and retirement", () => {
    const repository = readBuildsRepositoryModules();
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/product-service.ts"),
      "utf8",
    );

    expect(repository).toContain("expectedStatus?: Build");
    expect(repository).toContain("eq(builds.status, expectedStatus)");
    expect(repository).toContain("async function moderatePending(");
    expect(repository).toContain('eq(builds.status, "pending_review")');
    expect(repository).toContain("async function retireAndRefreshProduct(");
    expect(repository).toContain("db.transaction");
    const compactService = service.replace(/\s+/gu, "");
    expect(compactService).toContain("moderatePending(build.id,input.decision,{");
    expect(compactService).toContain("retireAndRefreshProduct(build.id,build.status,{");
  });
});
