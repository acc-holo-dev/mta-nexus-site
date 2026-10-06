import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("build quarantine policy", () => {
  it("models quarantine as a first-class build state with evidence metadata", () => {
    const domain = read("packages/domain/src/entities.ts");
    const schema = read("packages/db/src/schema.ts");
    expect(domain).toContain('| "quarantined"');
    expect(domain).toContain("quarantinePreviousStatus");
    expect(schema).toContain("builds_quarantine_metadata_check");
    expect(schema).toContain('quarantineReason: text("quarantine_reason")');
  });

  it("uses transactional compare-and-set containment and safe restore", () => {
    const repository = read("packages/db/src/repositories/builds.ts");
    expect(repository).toContain("quarantinePublishedAndRefreshProduct");
    expect(repository).toContain('eq(builds.status, "published")');
    expect(repository).toContain("restoreQuarantinedAndRefreshProduct");
    expect(repository).toContain('eq(builds.status, "quarantined")');
    expect(repository).toContain("trustedCleanScanCondition()");
    expect(repository).toContain("safePublishedBuildCondition(quarantined.productId)");
  });

  it("requires moderator actions and prevents seller retirement from bypassing quarantine", () => {
    const route = read("apps/web/src/app/api/admin/actions/route.ts");
    const page = read("apps/web/src/app/workspace/resources/[id]/page.tsx");
    expect(route).toContain('"quarantine", "restore"');
    expect(route).toContain("productService.quarantineBuild");
    expect(route).toContain("productService.restoreQuarantinedBuild");
    expect(page).toContain('build.status !== "quarantined"');
  });
});
