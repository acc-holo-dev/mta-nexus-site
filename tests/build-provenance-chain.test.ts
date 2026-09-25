import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("build provenance chain", () => {
  it("uses the storage-computed SHA-256 as the recorded build hash", () => {
    const upload = read(
      "apps/web/src/app/api/products/[id]/builds/route.ts",
    );
    const service = read(
      "apps/web/src/lib/services/product-service.ts",
    );

    expect(upload).toContain("sha256Hash: asset.sha256Hash");
    expect(service).toContain("sha256Hash: input.sha256Hash");
    expect(service).toContain("hash: input.sha256Hash");
  });

  it("shows the full recorded hash and exposes it on downloads", () => {
    const provenance = read(
      "apps/web/src/components/build-provenance-details.tsx",
    );
    const download = read(
      "apps/web/src/app/api/products/[id]/download/route.ts",
    );

    expect(provenance).toContain("{build.sha256Hash}");
    expect(provenance).toContain("select-all");
    expect(download).toContain(
      '"X-Content-SHA256": latestBuild.sha256Hash',
    );
  });

  it("keeps malware verdict and cryptographic signature as separate facts", () => {
    const provenance = read(
      "apps/web/src/components/build-provenance-details.tsx",
    );

    expect(provenance).toContain("A clean malware");
    expect(provenance).toContain(
      "is not a cryptographic",
    );
    expect(provenance).toContain(
      'build.isSigned ? "Recorded as signed" : "Not available"',
    );
    expect(provenance).not.toContain("SHA-256 verified");
    expect(provenance).not.toContain("Cryptographically verified");
  });
});
