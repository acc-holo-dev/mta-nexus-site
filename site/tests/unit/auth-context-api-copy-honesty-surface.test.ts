import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authContextApiCopy } from "../../src/features/accounts/auth-context-api-copy";

/** Wave 73: /api/auth/context errors use bilingual authContextApiCopy. */
describe("auth context API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the context route through nexus_locale", () => {
    const en = authContextApiCopy("en");
    const ru = authContextApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.accountChanged).toContain("Account changed");
    expect(ru.accountChanged).toContain("Аккаунт изменился");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/auth/context/route.ts"),
      "utf8",
    );
    expect(route).toContain("authContextApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.listUnavailable");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.invalidContext");
    expect(route).toContain("copy.accountChanged");
    expect(route).toContain("copy.switchFailed");
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Account contexts are temporarily unavailable."');
    expect(route).not.toContain('"Account changed. Reload contexts."');
    expect(route).not.toContain('"Failed to switch context"');
  });
});
