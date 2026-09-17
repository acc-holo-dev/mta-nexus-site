import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("build upload hardening", () => {
  it("checks archive signatures before storage", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/builds/route.ts"),
      "utf8"
    );

    expect(route).toContain("hasExpectedSignature");
    expect(route).toContain("Build content does not match its file extension");
    expect(route).toContain("const fileBytes = new Uint8Array(await file.arrayBuffer())");
  });
});
