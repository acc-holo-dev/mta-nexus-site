import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authPasswordApiCopy } from "../../src/features/accounts/auth-password-api-copy";

/** Wave 67: /api/auth/password errors use bilingual authPasswordApiCopy, not ad-hoc locale ternaries. */
describe("auth password API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the password route through nexus_locale", () => {
    const en = authPasswordApiCopy("en");
    const ru = authPasswordApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.accountChanged).toBe("Account changed. Reload settings and try again.");
    expect(ru.accountChanged).toBe("Аккаунт изменился. Обновите настройки и попробуйте снова.");
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/auth/password/route.ts"),
      "utf8",
    );
    expect(route).toContain("authPasswordApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.validationFailed");
    expect(route).toContain("copy.accountChanged");
    expect(route).toContain("copy.unavailable");
    expect(route).not.toContain('=== "ru"');
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Account changed. Reload settings and try again."');
  });
});
