import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { serverOrganizationsApiCopy } from "../../src/features/servers/server-organizations-api-copy";

/** Wave 80: /api/workspace/server-organizations errors use bilingual serverOrganizationsApiCopy. */
describe("server organizations API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the server-organizations route through nexus_locale", () => {
    const en = serverOrganizationsApiCopy("en");
    const ru = serverOrganizationsApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.unavailable).toContain("Organization options");
    expect(ru.unavailable).toContain("организаций");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/workspace/server-organizations/route.ts"),
      "utf8",
    );
    expect(route).toContain("serverOrganizationsApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.unavailable");
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Organization options temporarily unavailable"');
  });
});
