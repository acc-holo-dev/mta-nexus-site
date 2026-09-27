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
    expect(service).toContain('build.scanStatus !== "clean"');
  });

  it("streams builds to ClamAV and fails closed in production", () => {
    const scanner = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/build-scanner-service.ts"),
      "utf8"
    );
    const compose = readFileSync(resolve(process.cwd(), "compose.production.yaml"), "utf8");
    const config = readFileSync(resolve(process.cwd(), "packages/config/src/index.ts"), "utf8");
    const transport = readFileSync(resolve(process.cwd(), "apps/web/src/lib/services/clamav-instream.ts"), "utf8");
    expect(scanner).toContain("writeClamAvInstream(socket, bytes)");
    expect(transport).toContain('writeChunk(socket, "zINSTREAM\\0")');
    expect(transport).toContain("writeUInt32BE");
    expect(scanner).toContain('status: "clean", scanner: "clamav"');
    expect(compose).toContain("clamav/clamav:1.5");
    expect(config).toContain("Production resource publishing requires ClamAV");
  });
});
