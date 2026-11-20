import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authEmailVerificationApiCopy } from "../../src/features/accounts/auth-email-verification-api-copy";

/** Wave 74: /api/auth/email-verification errors use bilingual authEmailVerificationApiCopy. */
describe("auth email-verification API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the email-verification route through nexus_locale", () => {
    const en = authEmailVerificationApiCopy("en");
    const ru = authEmailVerificationApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.validationFailed).toContain("Email verification validation");
    expect(ru.validationFailed).toContain("подтверждения email");
    expect(en.invalidOrExpired).toContain("Invalid or expired");
    expect(ru.invalidOrExpired).toContain("просроченное");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/auth/email-verification/route.ts"),
      "utf8",
    );
    expect(route).toContain("authEmailVerificationApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.statusUnavailable");
    expect(route).toContain("copy.validationFailed");
    expect(route).toContain("copy.accountChanged");
    expect(route).toContain("copy.startFailed");
    expect(route).toContain("copy.invalidOrExpired");
    expect(route).toContain("copy.confirmFailed");
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Could not check recovery email status"');
    expect(route).not.toContain('"Email verification validation failed"');
    expect(route).not.toContain('"Account changed. Reload settings."');
    expect(route).not.toContain('"Could not start email verification. Please try again later."');
    expect(route).not.toContain('"Invalid or expired email confirmation"');
    expect(route).not.toContain('"Could not confirm this email. Please try again later."');
  });
});
