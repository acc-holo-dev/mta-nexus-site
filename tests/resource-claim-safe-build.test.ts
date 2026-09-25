import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("free resource claim safe-build gate", () => {
  it("requires a clean provenance-backed published build before entitlement creation", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/entitlements.ts"),
      "utf8",
    );

    const method = repository.indexOf("async claimFreeResource(");
    const productGate = repository.indexOf(
      'product.status !== "published"',
      method,
    );
    const buildStatus = repository.indexOf(
      'eq(builds.status, "published")',
      productGate,
    );
    const clean = repository.indexOf(
      'eq(builds.scanStatus, "clean")',
      buildStatus,
    );
    const scanner = repository.indexOf(
      "isNotNull(builds.scanner)",
      clean,
    );
    const scannedAt = repository.indexOf(
      "isNotNull(builds.scannedAt)",
      scanner,
    );
    const entitlementInsert = repository.indexOf(
      ".insert(entitlements)",
      scannedAt,
    );

    expect(method).toBeGreaterThan(-1);
    expect(productGate).toBeGreaterThan(method);
    expect(buildStatus).toBeGreaterThan(productGate);
    expect(clean).toBeGreaterThan(buildStatus);
    expect(scanner).toBeGreaterThan(clean);
    expect(scannedAt).toBeGreaterThan(scanner);
    expect(entitlementInsert).toBeGreaterThan(scannedAt);
  });
});
