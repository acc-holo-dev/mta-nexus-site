import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("safe published build invariant", () => {
  it("centralizes trusted scan and published build predicates", () => {
    const helper = read("packages/db/src/repositories/build-safety.ts");
    expect(helper).toContain('eq(builds.scanStatus, "clean")');
    expect(helper).toContain("isNotNull(builds.scanner)");
    expect(helper).toContain("btrim");
    expect(helper).toContain("isNotNull(builds.scannedAt)");
    expect(helper).toContain('eq(builds.status, "published")');
  });

  it("enforces the same rule in the database schema", () => {
    const schema = read("packages/db/src/schema.ts");
    expect(schema).toContain("builds_clean_scan_provenance_check");
    expect(schema).toContain("builds_published_safe_check");
  });

  it("requires a safe build before a free claim is inserted", () => {
    const repository = read("packages/db/src/repositories/entitlements.ts");
    const safeBuild = repository.indexOf("safePublishedBuildCondition(input.productId)");
    const insert = repository.indexOf(".insert(entitlements)", safeBuild);
    expect(safeBuild).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(safeBuild);
  });
});
