import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { licenseControlError } from "../../src/features/commerce/license-control-i18n";

/** Waves 287–290: bearer license checks keep valid+code and add remapped error. */
describe("license runtime additive error envelope honesty", () => {
  it("wires licenseControlError and forbids message passthrough", () => {
    const source = readFileSync(
      resolve(process.cwd(), "site/src/features/commerce/license-runtime-http.ts"),
      "utf8",
    );
    expect(source).toContain("licenseControlError");
    expect(source).toContain("resolveLocale");
    expect(source).toContain("valid: false");
    expect(source).not.toMatch(/error:\s*(?:error|appError)\.message/);
    expect(source).not.toMatch(/\{\s*valid:\s*false,\s*code:\s*error\.code\s*\}/);
  });

  it("localizes LICENSE_CHECK_* for both locales", () => {
    for (const locale of ["en", "ru"] as const) {
      expect(licenseControlError(locale, "LICENSE_CHECK_DENIED")).not.toBe(
        licenseControlError(locale, "UNKNOWN_CODE"),
      );
      expect(licenseControlError(locale, "LICENSE_CHECK_FAILED")).not.toBe(
        licenseControlError(locale, "UNKNOWN_CODE"),
      );
      expect(licenseControlError(locale, "LICENSE_CHECK_DENIED")).not.toEqual(
        licenseControlError(locale === "en" ? "ru" : "en", "LICENSE_CHECK_DENIED"),
      );
    }
  });
});
