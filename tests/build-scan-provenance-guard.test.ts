import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("build scan provenance guard", () => {
  it("requires scanner identity and scan timestamp for approval", () => {
    const repository = read("packages/db/src/repositories/builds.ts");
    const moderation = repository.slice(
      repository.indexOf("async moderatePending("),
      repository.indexOf("async retireAndRefreshProduct("),
    );

    expect(moderation).toContain('eq(builds.scanStatus, "clean")');
    expect(moderation).toContain("isNotNull(builds.scanner)");
    expect(moderation).toContain("isNotNull(builds.scannedAt)");
  });

  it("requires provenance in canonical latest-build resolution", () => {
    const repository = read("packages/db/src/repositories/builds.ts");
    const latest = repository.slice(
      repository.indexOf("async findLatestPublishedByProduct("),
      repository.indexOf("async updateStatus("),
    );

    expect(latest).toContain('eq(builds.scanStatus, "clean")');
    expect(latest).toContain("isNotNull(builds.scanner)");
    expect(latest).toContain("isNotNull(builds.scannedAt)");
  });

  it("keeps a direct delivery-side provenance guard before storage open", () => {
    const route = read(
      "apps/web/src/app/api/products/[id]/download/route.ts",
    );

    const guard = route.indexOf('latestBuild.scanStatus !== "clean"');
    const scanner = route.indexOf("!latestBuild.scanner", guard);
    const scannedAt = route.indexOf("!latestBuild.scannedAt", scanner);
    const storage = route.indexOf("storageService.getDownloadStream", scannedAt);

    expect(guard).toBeGreaterThan(-1);
    expect(scanner).toBeGreaterThan(guard);
    expect(scannedAt).toBeGreaterThan(scanner);
    expect(storage).toBeGreaterThan(scannedAt);
  });
});
