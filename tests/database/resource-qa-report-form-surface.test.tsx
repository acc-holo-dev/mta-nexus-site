import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResourceQaReportForm } from "../../apps/web/src/components/resource-qa-report-form";
import { resourceQaCopy } from "../../apps/web/src/lib/resource-qa-i18n";

describe("ResourceQaReportForm", () => {
  it.each(["en", "ru"] as const)("shows a report CTA for signed-in users in %s", (locale) => {
    const copy = resourceQaCopy(locale);
    const html = renderToStaticMarkup(
      <ResourceQaReportForm
        threadId="rqt_a"
        locale={locale}
        authenticated
        loginHref="/auth/login"
        registerHref="/auth/register"
      />,
    );
    expect(html).toContain(copy.report);
  });

  it.each(["en", "ru"] as const)("asks guests to sign in before reporting in %s", (locale) => {
    const copy = resourceQaCopy(locale);
    const html = renderToStaticMarkup(
      <ResourceQaReportForm
        threadId="rqt_a"
        locale={locale}
        authenticated={false}
        loginHref="/auth/login"
        registerHref="/auth/register"
      />,
    );
    expect(html).toContain(copy.reportSignIn);
  });
});
