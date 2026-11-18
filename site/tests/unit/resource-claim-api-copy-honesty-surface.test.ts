import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resourceClaimApiCopy } from "../../src/features/resources/resource-claim-api-copy";

/** Wave 76: /api/resources/claim errors use bilingual resourceClaimApiCopy. */
describe("resource claim API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the claim route through nexus_locale", () => {
    const en = resourceClaimApiCopy("en");
    const ru = resourceClaimApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.invalidClaim).toContain("Invalid resource claim");
    expect(ru.invalidClaim).toContain("Некорректный");
    expect(en.claimFailed).toBe("Resource claim failed");
    expect(ru.claimFailed).toContain("получить ресурс");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/resources/claim/route.ts"),
      "utf8",
    );
    expect(route).toContain("resourceClaimApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.invalidClaim");
    expect(route).toContain("copy.claimFailed");
    expect(route).not.toContain('"Too many resource claims. Please try again later."');
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Invalid resource claim"');
    expect(route).not.toContain('"Resource claim failed"');
  });
});
