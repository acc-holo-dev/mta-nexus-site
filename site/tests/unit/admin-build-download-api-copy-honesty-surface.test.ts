import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { adminBuildDownloadApiCopy } from "../../src/features/resources/admin-build-download-api-copy";

/** Wave 98: /api/admin/builds/[buildId]/download errors use bilingual adminBuildDownloadApiCopy. */
describe("admin build download API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the reviewer download route through nexus_locale", () => {
    const en = adminBuildDownloadApiCopy("en");
    const ru = adminBuildDownloadApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.moderatorRequired).toBe("Moderator access required");
    expect(ru.moderatorRequired).toContain("модератора");
    expect(en.scanProvenanceRequired).toContain("provenance-backed");
    expect(ru.notAvailableForReview).toContain("модератором");
    expect(en.deliverFailed).toContain("reviewer artifact");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/admin/builds/[buildId]/download/route.ts"),
      "utf8",
    );
    expect(route).toContain("adminBuildDownloadApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.moderatorRequired");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.notFound");
    expect(route).toContain("copy.notAvailableForReview");
    expect(route).toContain("copy.scanProvenanceRequired");
    expect(route).toContain("copy.cancelled");
    expect(route).toContain("copy.artifactMismatch");
    expect(route).toContain("copy.fileUnavailable");
    expect(route).toContain("copy.evidenceChanged");
    expect(route).toContain("copy.deliverFailed");
    expect(route).not.toContain('"Moderator access required"');
    expect(route).not.toContain('"Build is not available for moderator evidence review"');
    expect(route).not.toContain(
      '"Reviewer download requires a provenance-backed clean malware scan"',
    );
    expect(route).not.toContain('"Could not deliver reviewer artifact"');
  });
});
