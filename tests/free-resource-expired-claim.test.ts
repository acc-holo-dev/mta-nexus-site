import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("free claim active entitlement semantics", () => {
  it("uses the same expiry predicate for claim idempotency as entitlement access", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/entitlements.ts"),
      "utf8",
    );

    const claimSection = repository.slice(
      repository.indexOf("async claimFreeResource"),
    );
    expect(claimSection).toContain("isNull(entitlements.expiresAt)");
    expect(claimSection).toContain("gt(entitlements.expiresAt, now)");
    expect(claimSection).toContain("const now = new Date()");
  });
});

