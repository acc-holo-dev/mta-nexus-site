import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { adminActionsApiCopy } from "../../src/features/moderation/admin-actions-api-copy";

/** Wave 98: /api/admin/actions route-authored errors use bilingual adminActionsApiCopy. */
describe("admin actions API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the admin actions route through nexus_locale", () => {
    const en = adminActionsApiCopy("en");
    const ru = adminActionsApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.forbidden).toContain("Admin or moderator");
    expect(ru.forbidden).toContain("модератора");
    expect(en.executeFailed).toContain("administrative action");
    expect(ru.productNotFound).toContain("не найден");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/admin/actions/route.ts"),
      "utf8",
    );
    expect(route).toContain("adminActionsApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.forbidden");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.invalidAction");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.productNotFound");
    expect(route).toContain("copy.reportNotFound");
    expect(route).toContain("copy.verificationNotFound");
    expect(route).toContain("copy.executeFailed");
    expect(route).toContain("localeAppErrorText");
    expect(route).not.toContain("error.message");
    expect(route).not.toContain('"Forbidden: Admin or moderator privilege required"');
    expect(route).not.toContain('"Too many admin actions"');
    expect(route).not.toContain('"Invalid moderation action"');
    expect(route).not.toContain('"Failed to execute administrative action"');
    expect(route).not.toContain('"Product not found"');
    expect(route).not.toContain('"Report not found"');
    expect(route).not.toContain('"Verification request not found"');
  });
});
