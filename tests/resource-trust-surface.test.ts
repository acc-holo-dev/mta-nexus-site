import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuildProvenanceDetails } from "../apps/web/src/components/build-provenance-details";
import { getDictionary } from "../apps/web/src/lib/i18n";

describe("resource trust surface behavior", () => {
  it.each(["en", "ru"] as const)(
    "renders recorded provenance facts without overstating verification in %s",
    (locale) => {
      const copy = getDictionary(locale).provenance;
      const hash = "ab".repeat(32);
      const html = renderToStaticMarkup(
        <BuildProvenanceDetails
          locale={locale}
          build={{
            status: "published",
            sha256Hash: hash,
            fileName: "resource.zip",
            mimeType: "application/zip",
            scanStatus: "clean",
            scanner: "clamav",
            scannedAt: new Date("2026-10-08T00:00:00.000Z"),
            mtaVersionTarget: "1.6.0-9.22279.0",
            isSigned: false,
          }}
        />,
      );

      expect(html).toContain(copy.title);
      expect(html).toContain(copy.cleanScanRecorded);
      expect(html).toContain("clamav");
      expect(html).toContain(hash);
      expect(html).toContain("resource.zip");
      expect(html).toContain("1.6.0-9.22279.0");
      expect(html).toContain(copy.notAvailable);
      expect(html).toContain(copy.explanation);
      expect(html).not.toMatch(
        /SHA-256 (?:validated|verified)|cryptographically verified/iu,
      );
    },
  );

  it("keeps an unscanned unsigned build visibly non-verified", () => {
    const copy = getDictionary("en").provenance;
    const html = renderToStaticMarkup(
      <BuildProvenanceDetails
        locale="en"
        build={{
          status: "pending_review",
          sha256Hash: "cd".repeat(32),
          fileName: "resource.lua",
          mimeType: "text/plain",
          scanStatus: "not_scanned",
          scanner: undefined,
          scannedAt: undefined,
          mtaVersionTarget: undefined,
          isSigned: false,
        }}
      />,
    );

    expect(html).toContain(copy.scanNotRecorded);
    expect(html).toContain(copy.noCleanVerdict);
    expect(html).toContain(copy.notRecorded);
    expect(html).toContain(copy.notDeclared);
    expect(html).toContain(copy.notAvailable);
  });
});
