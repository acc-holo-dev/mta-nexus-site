import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contentApiCopy } from "../../src/features/community/content-api-copy";

/** Waves 86/98: content detail + collection envelopes use bilingual contentApiCopy. */
describe("content API copy honesty surface", () => {
  it("keeps RU/EN keys and wires detail + collection routes through nexus_locale", () => {
    const en = contentApiCopy("en");
    const ru = contentApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.notFound).toBe("Article not found");
    expect(ru.notFound).toBe("Статья не найдена");
    expect(en.unavailable).toContain("temporarily unavailable");
    expect(ru.listUnavailable).toContain("временно недоступен");
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.organizationNotManaged).toContain("организацией");
    expect(en.createFailed).toContain("Failed to create");

    const detail = readFileSync(
      resolve(process.cwd(), "site/src/app/api/content/[slug]/route.ts"),
      "utf8",
    );
    expect(detail).toContain("contentApiCopy");
    expect(detail).toContain("resolveLocale");
    expect(detail).toContain("nexus_locale");
    expect(detail).toContain("copy.notFound");
    expect(detail).toContain("copy.unavailable");
    expect(detail).not.toContain('"Article not found"');
    expect(detail).not.toContain('"Article is temporarily unavailable"');

    const collection = readFileSync(
      resolve(process.cwd(), "site/src/app/api/content/route.ts"),
      "utf8",
    );
    expect(collection).toContain("contentApiCopy");
    expect(collection).toContain("resolveLocale");
    expect(collection).toContain("nexus_locale");
    expect(collection).toContain("copy.listUnavailable");
    expect(collection).toContain("copy.authenticationRequired");
    expect(collection).toContain("copy.creationLimitExceeded");
    expect(collection).toContain("copy.invalidDetails");
    expect(collection).toContain("copy.linkedServerNotFound");
    expect(collection).toContain("copy.linkedServerNotManaged");
    expect(collection).toContain("copy.linkedResourceNotFound");
    expect(collection).toContain("copy.linkedResourceNotManaged");
    expect(collection).toContain("copy.linkedOrganizationNotFound");
    expect(collection).toContain("copy.organizationNotManaged");
    expect(collection).toContain("copy.creationRetry");
    expect(collection).toContain("copy.createFailed");
    expect(collection).toContain("localeAppErrorText");
    expect(collection).not.toContain("error.message");
    expect(collection).not.toContain('"Published content is temporarily unavailable"');
    expect(collection).not.toContain('"Authentication required"');
    expect(collection).not.toContain('"Failed to create content"');
    expect(collection).not.toContain('"You do not manage this organization"');
  });
});
