import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authSessionsApiCopy } from "../../src/features/accounts/auth-sessions-api-copy";

/** Wave 69: /api/auth/sessions errors use bilingual authSessionsApiCopy. */
describe("auth sessions API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the sessions route through nexus_locale", () => {
    const en = authSessionsApiCopy("en");
    const ru = authSessionsApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.accountChanged).toContain("Account changed");
    expect(ru.accountChanged).toContain("Аккаунт изменился");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/auth/sessions/route.ts"),
      "utf8",
    );
    expect(route).toContain("authSessionsApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.listUnavailable");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.invalidAction");
    expect(route).toContain("copy.accountChanged");
    expect(route).toContain("copy.currentSessionBlocked");
    expect(route).toContain("copy.sessionNotFound");
    expect(route).toContain("copy.updateUnavailable");
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Account settings are temporarily unavailable."');
    expect(route).not.toContain('"Account changed. Reload settings and try again."');
  });
});
