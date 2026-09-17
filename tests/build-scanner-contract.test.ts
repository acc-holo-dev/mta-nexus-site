import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("resource build scanner contract", () => {
  it("keeps disabled scanning explicit and blocks malicious scanner verdicts", () => {
    const scanner = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/build-scanner-service.ts"),
      "utf8"
    );
    const upload = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/builds/route.ts"),
      "utf8"
    );
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/product-service.ts"),
      "utf8"
    );

    expect(scanner).toContain('status: "not_scanned"');
    expect(scanner).toContain('scanner: "disabled"');
    expect(upload).toContain("buildScannerService.scan");
    expect(upload).toContain('scan.status === "malicious"');
    expect(service).toContain('build.scanStatus === "malicious"');
  });
});
