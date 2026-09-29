import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("build version delivery contract", () => {
  it("pins release-history downloads to that exact trusted build", () => {
    const route = read("apps/web/src/app/api/products/[id]/download/route.ts");
    const page = read("apps/web/src/app/market/[slug]/page.tsx");

    expect(route).toContain('request.nextUrl.searchParams.get("buildId")');
    expect(route).toContain("builds.find((build) => build.id === requestedBuildId)");
    expect(route).toContain("buildRepository.listPublishedByProduct(productId)");
    expect(route).toContain('"Requested build is not available"');
    expect(page).toContain("?buildId=${encodeURIComponent(b.id)}");
    expect(page).toContain("hasTrustedCleanBuildScanEvidence(b)");
  });

  it("labels and links the latest available trusted release, not an unrelated product version", () => {
    const page = read("apps/web/src/app/market/[slug]/page.tsx");
    const repository = read("packages/db/src/repositories/builds.ts");

    expect(page).toContain("const latestDownloadableBuild = builds.find(");
    expect(page).toContain("latestDownloadableBuild?.version");
    expect(page).toContain("Download Build v{latestDownloadableBuild.version}");
    expect(page).toContain("No approved, scanned build is available to download yet.");
    expect(repository).toContain(".orderBy(desc(builds.createdAt))");
  });
});
