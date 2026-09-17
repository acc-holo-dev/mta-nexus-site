import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("resource download delivery", () => {
  it("preserves only a safe build extension and disables MIME sniffing", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/download/route.ts"),
      "utf8"
    );

    expect(route).toContain("const DOWNLOAD_EXTENSIONS");
    expect(route).toContain("getDownloadExtension(latestBuild.storageKey)");
    expect(route).toContain('"X-Content-Type-Options": "nosniff"');
  });
});
