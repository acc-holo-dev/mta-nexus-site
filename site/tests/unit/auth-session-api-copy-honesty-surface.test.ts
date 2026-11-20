import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authSessionApiCopy } from "../../src/features/accounts/auth-session-api-copy";

/** Wave 68: /api/auth/session errors use bilingual authSessionApiCopy. */
describe("auth session API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the session route through nexus_locale", () => {
    const en = authSessionApiCopy("en");
    const ru = authSessionApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.checkUnavailable).toBe("Could not check session");
    expect(ru.checkUnavailable).toBe("Не удалось проверить сессию");
    expect(en.accountChanged).toContain("Account changed");
    expect(ru.accountChanged).toContain("Аккаунт изменился");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/auth/session/route.ts"),
      "utf8",
    );
    expect(route).toContain("authSessionApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.checkUnavailable");
    expect(route).toContain("copy.invalidSignOut");
    expect(route).toContain("copy.accountChanged");
    expect(route).toContain("copy.signOutUnavailable");
    expect(route).not.toContain('"Could not check session"');
    expect(route).not.toContain('"Invalid sign out request"');
    expect(route).not.toContain('"Account changed. Reload and try again."');
    expect(route).not.toContain('"Could not confirm sign out. Please try again."');
  });
});
