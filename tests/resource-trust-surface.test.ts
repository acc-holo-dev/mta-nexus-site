import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("resource trust surface", () => {
  it("presents build metadata without claiming an unchecked upload is verified", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/market/[slug]/page.tsx"),
      "utf8"
    );

    expect(page).toContain("SHA-256 recorded");
    expect(page).toContain("Signature: not available");
    expect(page).toContain("recorded checksum is not a malware verdict or signature");
    expect(page).not.toContain("SHA-256 Validated");
  });
});
