import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resourceInspectMetaApiCopy } from "../../src/features/resources/resource-inspect-meta-api-copy";

/** Wave 78 errors + Wave 82 success note: inspect-meta via bilingual resourceInspectMetaApiCopy. */
describe("resource inspect-meta API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the inspect-meta route through nexus_locale", () => {
    const en = resourceInspectMetaApiCopy("en");
    const ru = resourceInspectMetaApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.developerRequired).toContain("Developer access");
    expect(ru.developerRequired).toContain("разработчика");
    expect(en.textPlainRequired).toContain("text/plain");
    expect(ru.inspectFailed).toContain("meta.xml");
    expect(en.note).toContain("Static manifest inspection only");
    expect(ru.note).toContain("статическая проверка манифеста");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/resources/inspect-meta/route.ts"),
      "utf8",
    );
    expect(route).toContain("resourceInspectMetaApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.developerRequired");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.textPlainRequired");
    expect(route).toContain("copy.exceedsLimit");
    expect(route).toContain("copy.inspectFailed");
    expect(route).toContain("copy.note");
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Developer access required"');
    expect(route).not.toContain('"Too many resource inspections. Please try again shortly."');
    expect(route).not.toContain('"Send meta.xml as text/plain"');
    expect(route).not.toContain('"meta.xml exceeds the inspection limit"');
    expect(route).not.toContain('"Could not inspect meta.xml"');
    expect(route).not.toContain('"Static manifest inspection only');
  });
});
