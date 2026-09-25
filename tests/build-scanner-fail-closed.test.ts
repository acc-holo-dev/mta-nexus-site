import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("build scanner fail-closed upload flow", () => {
  it("rejects malicious and scanner-error verdicts before private storage", () => {
    const route = read(
      "apps/web/src/app/api/products/[id]/builds/route.ts",
    );

    const malicious = route.indexOf('scan.status === "malicious"');
    const unavailable = route.indexOf('scan.status === "error"');
    const storage = route.indexOf("storageService.uploadAsset");

    expect(malicious).toBeGreaterThan(-1);
    expect(unavailable).toBeGreaterThan(malicious);
    expect(storage).toBeGreaterThan(unavailable);
    expect(route).toContain("No build was stored; retry the upload later.");
    expect(route).toContain('status: 503, headers: { "Retry-After": "30" }');
  });

  it("keeps non-clean builds impossible to approve", () => {
    const service = read(
      "apps/web/src/lib/services/product-service.ts",
    );
    const config = read("packages/config/src/index.ts");

    expect(service).toContain('build.scanStatus !== "clean"');
    expect(service).toContain('"BUILD_SCAN_NOT_CLEAN"');
    expect(config).toContain(
      "Production resource publishing requires ClamAV",
    );
  });

  it("moves INSTREAM framing into a backpressure-aware transport helper", () => {
    const scanner = read(
      "apps/web/src/lib/services/build-scanner-service.ts",
    );
    const transport = read(
      "apps/web/src/lib/services/clamav-instream.ts",
    );

    expect(scanner).toContain("writeClamAvInstream(socket, bytes)");
    expect(scanner).not.toContain("socket.write(length)");
    expect(transport).toContain('socket.once("drain"');
    expect(transport).toContain("await waitForDrain(socket)");
    expect(transport).toContain("64 * 1024");
  });
});
