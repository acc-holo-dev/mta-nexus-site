import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasTrustedCleanBuildScanEvidence } from "../packages/domain/src/build-scan-evidence";

describe("trusted build scan evidence", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");

  it("accepts only a clean ClamAV result with a valid non-future timestamp", () => {
    expect(hasTrustedCleanBuildScanEvidence({
      scanStatus: "clean",
      scanner: "clamav",
      scannedAt: new Date("2026-09-28T11:59:00.000Z"),
    }, now)).toBe(true);
    expect(hasTrustedCleanBuildScanEvidence({
      scanStatus: "clean",
      scanner: "clamav",
      scannedAt: new Date("2026-09-28T12:00:00.000Z"),
    }, now)).toBe(true);
  });

  it("rejects missing, invalid, future, non-ClamAV or non-clean evidence", () => {
    const invalidCases = [
      { scanStatus: "not_scanned", scanner: "clamav", scannedAt: now },
      { scanStatus: "clean", scanner: "disabled", scannedAt: now },
      { scanStatus: "clean", scanner: "clamav", scannedAt: undefined },
      { scanStatus: "clean", scanner: "clamav", scannedAt: new Date("invalid") },
      { scanStatus: "clean", scanner: "clamav", scannedAt: new Date(now.getTime() + 1) },
    ] as const;

    for (const evidence of invalidCases) {
      expect(hasTrustedCleanBuildScanEvidence(evidence, now)).toBe(false);
    }
  });

  it("applies the evidence policy in database publication, public listing and delivery", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/builds.ts"),
      "utf8"
    );
    const download = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/download/route.ts"),
      "utf8"
    );
    expect(repository).toContain('eq(builds.scanner, "clamav")');
    expect(repository).toContain("isNotNull(builds.scannedAt)");
    expect(repository).toContain("lte(builds.scannedAt, now)");
    expect(repository).toContain("...trustedCleanScanConditions()");
    expect(download).toContain("buildRepository.listPublishedByProduct(productId)");
  });
});
