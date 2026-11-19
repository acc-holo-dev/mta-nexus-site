import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { productDownloadApiCopy } from "../../src/features/resources/product-download-api-copy";

/** Wave 95: /api/products/[id]/download errors use bilingual productDownloadApiCopy. */
describe("product download API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the download route through nexus_locale", () => {
    const en = productDownloadApiCopy("en");
    const ru = productDownloadApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toContain("Authentication required to download");
    expect(ru.libraryRequired).toContain("библиотеку");
    expect(en.deliverFailed).toContain("Failed to deliver");
    expect(ru.cancelled).toContain("отменена");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/products/[id]/download/route.ts"),
      "utf8",
    );
    expect(route).toContain("productDownloadApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.notFound");
    expect(route).toContain("copy.libraryRequired");
    expect(route).toContain("copy.invalidBuild");
    expect(route).toContain("copy.noPublishedBuild");
    expect(route).toContain("copy.notCleared");
    expect(route).toContain("copy.cancelled");
    expect(route).toContain("copy.artifactMismatch");
    expect(route).toContain("copy.fileUnavailable");
    expect(route).toContain("copy.deliverFailed");
    expect(route).toContain("localeAppErrorText");
    expect(route).not.toContain("error.message");
    expect(route).not.toContain('"Authentication required to download resource builds"');
    expect(route).not.toContain('"Too many download requests"');
    expect(route).not.toContain('"Resource not found"');
    expect(route).not.toContain('"Add this resource to your library before downloading it"');
    expect(route).not.toContain('"Invalid requested build"');
    expect(route).not.toContain('"No published build is available"');
    expect(route).not.toContain('"Published build is not cleared for delivery"');
    expect(route).not.toContain('"Download cancelled"');
    expect(route).not.toContain('"Build file does not match its recorded metadata"');
    expect(route).not.toContain('"Resource build file is not available"');
    expect(route).not.toContain('"Failed to deliver resource build"');
  });
});
