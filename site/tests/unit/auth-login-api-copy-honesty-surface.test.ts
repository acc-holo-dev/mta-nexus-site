import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authLoginApiCopy } from "../../src/features/accounts/auth-login-api-copy";

/** Wave 70: /api/auth/login errors use bilingual authLoginApiCopy. */
describe("auth login API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the login route through nexus_locale", () => {
    const en = authLoginApiCopy("en");
    const ru = authLoginApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.invalidCredentials).toBe("Invalid login credentials");
    expect(ru.invalidCredentials).toBe("Неверные данные для входа");
    expect(en.rate).toContain("Too many login attempts");
    expect(ru.rate).toContain("попыток входа");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/auth/login/route.ts"),
      "utf8",
    );
    expect(route).toContain("authLoginApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.invalidCredentials");
    expect(route).toContain("copy.failed");
    expect(route).not.toContain('"Too many login attempts');
    expect(route).not.toContain('"Invalid login credentials"');
    expect(route).not.toContain('"Failed to log in"');
  });
});
