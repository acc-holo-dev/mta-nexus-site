import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { productBuildsApiCopy } from "../../src/features/resources/product-builds-api-copy";

/** Wave 97: /api/products/[id]/builds POST errors use bilingual productBuildsApiCopy. */
describe("product builds API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the builds route through nexus_locale", () => {
    const en = productBuildsApiCopy("en");
    const ru = productBuildsApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.multipartRequired).toContain("multipart/form-data");
    expect(ru.malwareDetected).toContain("антивирус");
    expect(en.archiveTooLarge(50)).toContain("50MB");
    expect(ru.archiveTooLarge(50)).toContain("50");
    expect(en.scannerUnavailable).toContain("No build was stored");
    expect(ru.scannerUnavailable).toContain("не сохранена");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/products/[id]/builds/route.ts"),
      "utf8",
    );
    expect(route).toContain("productBuildsApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.actorRequired");
    expect(route).toContain("copy.actorChanged");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.archiveTooLarge");
    expect(route).toContain("copy.multipartRequired");
    expect(route).toContain("copy.multipartInvalid");
    expect(route).toContain("copy.metadataInvalid");
    expect(route).toContain("copy.fileTypeNotAllowed");
    expect(route).toContain("copy.fileNameInvalid");
    expect(route).toContain("copy.contentMismatch");
    expect(route).toContain("copy.malwareDetected");
    expect(route).toContain("copy.scanLimitExceeded");
    expect(route).toContain("copy.scannerUnavailable");
    expect(route).toContain("copy.publishFailed");
    expect(route).toContain("error.message");
    expect(route).toContain("error.code");
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Build upload requires multipart/form-data"');
    expect(route).not.toContain('"Build was rejected by the malware scanner"');
    expect(route).not.toContain('"Could not publish build"');
  });
});
