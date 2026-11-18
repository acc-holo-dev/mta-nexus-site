import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authPasswordResetApiCopy } from "../../src/features/accounts/auth-password-reset-api-copy";

/** Wave 71: /api/auth/password-reset errors use bilingual authPasswordResetApiCopy. */
describe("auth password-reset API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the password-reset route through nexus_locale", () => {
    const en = authPasswordResetApiCopy("en");
    const ru = authPasswordResetApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.invalidEmail).toBe("Enter a valid email address.");
    expect(ru.invalidEmail).toContain("электронной почты");
    expect(en.invalidOrExpired).toContain("Invalid or expired");
    expect(ru.invalidOrExpired).toContain("недействительна");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/auth/password-reset/route.ts"),
      "utf8",
    );
    expect(route).toContain("authPasswordResetApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.invalidEmail");
    expect(route).toContain("copy.invalidBody");
    expect(route).toContain("copy.requestUnavailable");
    expect(route).toContain("copy.invalidOrExpired");
    expect(route).toContain("copy.confirmUnavailable");
    expect(route).not.toContain('"Enter a valid email address."');
    expect(route).not.toContain('"Invalid or expired password reset"');
    expect(route).not.toContain('"Password reset is temporarily unavailable');
  });
});
