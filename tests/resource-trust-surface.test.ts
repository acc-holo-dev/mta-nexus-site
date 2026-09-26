import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("resource trust surface", () => {
  it("presents build metadata without claiming an unchecked upload is verified", () => {
    const page = read(
      "apps/web/src/app/market/[slug]/page.tsx",
    );

    expect(page).toContain("copy.shaRecorded");
    expect(page).toContain("build.mtaVersionTarget");
    expect(page).toContain("copy.signatureMissing");
    expect(page).toContain("copy.security");
    expect(page).toContain("<BuildProvenanceDetails");
    expect(page).not.toContain("SHA-256 Validated");
  });

  it("collects and validates compatibility for both the product and release", () => {
    const form = read(
      "apps/web/src/app/workspace/resources/new/page.tsx",
    );
    const route = read(
      "apps/web/src/app/api/products/[id]/builds/route.ts",
    );

    expect(form).toContain('form.get("dependencies")');
    expect(form).toContain(
      'buildForm.set("mtaVersionTarget"',
    );
    expect(route).toContain("mtaVersionTarget: z");
    expect(route).toContain(
      "mtaVersionTarget: parsed.data.mtaVersionTarget",
    );
  });
});
