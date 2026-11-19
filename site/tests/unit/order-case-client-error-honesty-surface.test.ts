import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { orderCaseCopy, orderCaseError } from "../../src/features/commerce/order-case-i18n";

/** Waves 199–201: purchase-case clients remap API codes without body.error passthrough. */
describe("orderCaseError honesty surface", () => {
  it("maps exists/conflict/validation/rate codes for both locales", () => {
    for (const locale of ["en", "ru"] as const) {
      const copy = orderCaseCopy(locale);
      expect(orderCaseError(locale, "ORDER_CASE_EXISTS")).toBe(copy.exists);
      expect(orderCaseError(locale, "ORDER_CASE_REVISION_CONFLICT")).toBe(copy.conflict);
      expect(orderCaseError(locale, "CONFLICT")).toBe(copy.conflict);
      expect(orderCaseError(locale, "VALIDATION_ERROR")).toBe(copy.invalid);
      expect(orderCaseError(locale, "ORDER_CASE_RECONCILIATION_REQUIRED")).toBe(
        copy.recommendationBlocked,
      );
      expect(orderCaseError(locale, "FORBIDDEN")).toBe(copy.failed);
      expect(orderCaseError(locale, "RATE_LIMIT_EXCEEDED")).toBe(copy.uncertain);
      expect(orderCaseError(locale, "UNKNOWN_CODE")).toBe(copy.uncertain);
    }
    expect(orderCaseError("en", "CONFLICT")).not.toEqual(orderCaseError("ru", "CONFLICT"));
  });

  it("keeps create/review forms on the remapper", () => {
    const forms = readFileSync(
      resolve(process.cwd(), "site/src/features/commerce/components/order-case-forms.tsx"),
      "utf8",
    );
    const copy = readFileSync(
      resolve(process.cwd(), "site/src/features/commerce/order-case-i18n.ts"),
      "utf8",
    );
    expect(forms).toContain("orderCaseError");
    expect(copy).toContain("export function orderCaseError");
    expect(forms).not.toMatch(/setError\(\s*result\?\.error/);
    expect(forms).not.toMatch(/setMessage\(\s*data\?\.error/);
  });
});
