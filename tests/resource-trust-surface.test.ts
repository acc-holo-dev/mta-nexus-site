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
    expect(page).toContain('b.mtaVersionTarget ? `>= ${b.mtaVersionTarget}` : "Not declared"');
    expect(page).toContain("Signature: not available");
    expect(page).toContain("recorded checksum is not a malware verdict or signature");
    expect(page).not.toContain("SHA-256 Validated");
  });

  it("collects and validates compatibility for both the product and release", () => {
    const form = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/workspace/resources/new/page.tsx"),
      "utf8"
    );
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/builds/route.ts"),
      "utf8"
    );
    expect(form).toContain('form.get("dependencies")');
    expect(form).toContain('buildForm.set("mtaVersionTarget"');
    expect(route).toContain("mtaVersionTarget: z");
    expect(route).toContain("mtaVersionTarget: parsed.data.mtaVersionTarget");
  });
});
