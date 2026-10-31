import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuildProvenanceDetails } from "../apps/web/src/components/build-provenance-details";
import { getDictionary } from "../apps/web/src/lib/i18n";

function renderBuild(build: React.ComponentProps<typeof BuildProvenanceDetails>["build"]) {
  return renderToStaticMarkup(React.createElement(BuildProvenanceDetails, { build }));
}

describe("build provenance chain behavior", () => {
  it("renders the full recorded hash as selectable provenance", () => {
    const hash = "12".repeat(32);
    const html = renderBuild({
      status: "published",
      sha256Hash: hash,
      fileName: "trusted.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "clamav",
      scannedAt: new Date("2026-10-08T00:00:00.000Z"),
      mtaVersionTarget: "1.6.0",
      isSigned: true,
    });

    expect(html).toContain(hash);
    expect(html).toContain("select-all");
  });

  it("keeps malware verdict, recorded hash and signature record as separate facts", () => {
    const copy = getDictionary("en").provenance;
    const html = renderBuild({
      status: "rejected",
      sha256Hash: "34".repeat(32),
      fileName: "blocked.zip",
      mimeType: "application/zip",
      scanStatus: "malicious",
      scanner: "clamav",
      scannedAt: new Date("2026-10-08T00:00:00.000Z"),
      mtaVersionTarget: "1.6.0",
      isSigned: true,
    });

    expect(html).toContain(copy.blockedMalicious);
    expect(html).toContain(copy.recordedAsSigned);
    expect(html).toContain(copy.trustedCleanMissing);
    expect(html).toContain(copy.explanation);
    expect(html).not.toMatch(/SHA-256 verified|cryptographically verified/iu);
  });

  it("surfaces build id, version, size and trusted clean gate when recorded", () => {
    const copy = getDictionary("en").provenance;
    const html = renderBuild({
      id: "bld_trusted_1",
      version: "2.1.0",
      status: "published",
      sha256Hash: "56".repeat(32),
      fileName: "release.zip",
      fileSizeBytes: 4096,
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "clamav",
      scannedAt: new Date("2026-10-08T00:00:00.000Z"),
      mtaVersionTarget: "1.6.0",
      isSigned: false,
    });

    expect(html).toContain("bld_trusted_1");
    expect(html).toContain("2.1.0");
    expect(html).toContain("4,096 B");
    expect(html).toContain(copy.trustedCleanMet);
    expect(html).toContain(copy.buildId);
    expect(html).toContain(copy.version);
  });
});
