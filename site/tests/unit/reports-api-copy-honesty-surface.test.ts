import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { reportsApiCopy } from "../../src/features/moderation/reports-api-copy";

/** Wave 75: /api/reports errors use bilingual reportsApiCopy. */
describe("reports API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the reports route through nexus_locale", () => {
    const en = reportsApiCopy("en");
    const ru = reportsApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toContain("Authentication required");
    expect(ru.authenticationRequired).toContain("вход");
    expect(en.cannotReportSelf).toContain("own account");
    expect(ru.cannotReportSelf).toContain("собственн");
    expect(en.alreadyOpen).toContain("open report");
    expect(ru.alreadyOpen).toContain("открытая жалоба");

    const route = readFileSync(resolve(process.cwd(), "site/src/app/api/reports/route.ts"), "utf8");
    expect(route).toContain("reportsApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.unauthorized");
    expect(route).toContain("copy.invalidPageOrView");
    expect(route).toContain("copy.listFailed");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.validationFailed");
    expect(route).toContain("copy.cannotReportSelf");
    expect(route).toContain("copy.alreadyOpen");
    expect(route).toContain("copy.retry");
    expect(route).toContain("copy.submitFailed");
    expect(route).not.toContain('"Unauthorized"');
    expect(route).not.toContain('"Invalid report page or view"');
    expect(route).not.toContain('"Failed to load reports"');
    expect(route).not.toContain('"Authentication required to submit report"');
    expect(route).not.toContain('"Too many reports submitted. Please try again later."');
    expect(route).not.toContain('"Validation error"');
    expect(route).not.toContain('"You cannot report your own account"');
    expect(route).not.toContain('"You already have an open report for this target"');
    expect(route).not.toContain('"Please retry submitting the report"');
    expect(route).not.toContain('"Failed to submit report"');
  });
});
