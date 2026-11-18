import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authRegisterApiCopy } from "../../src/features/accounts/auth-register-api-copy";

/** Wave 72: /api/auth/register errors use bilingual authRegisterApiCopy. */
describe("auth register API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the register route through nexus_locale", () => {
    const en = authRegisterApiCopy("en");
    const ru = authRegisterApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.validationFailed).toBe("Validation failed");
    expect(ru.validationFailed).toContain("Проверка");
    expect(en.rate).toContain("Too many registration");
    expect(ru.rate).toContain("регистрации");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/auth/register/route.ts"),
      "utf8",
    );
    expect(route).toContain("authRegisterApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.validationFailed");
    expect(route).toContain("copy.failed");
    expect(route).not.toContain('"Too many registration attempts');
    expect(route).not.toContain('"Validation failed"');
    expect(route).not.toContain('"Failed to register"');
  });
});
