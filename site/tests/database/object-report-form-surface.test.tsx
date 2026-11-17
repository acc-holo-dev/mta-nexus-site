import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ObjectReportForm } from "../../src/features/moderation/object-report";
import { platformReportCopy } from "../../src/features/moderation/platform-report-i18n";

vi.mock("@nexus/ui", async () => {
  const React = await import("react");
  return {
    Button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) =>
      React.createElement("button", props, children),
    ErrorState: ({ title, action }: { title: string; action?: React.ReactNode }) =>
      React.createElement("div", { role: "alert" }, title, action),
  };
});
it.each(["en", "ru"] as const)(
  "offers report recovery when session identity is unavailable in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <ObjectReportForm
        targetType="user"
        targetId="usr_a"
        locale={locale}
        authenticated={null}
        retryHref="/users/alice"
        loginHref="/auth/login"
        registerHref="/auth/register"
      />,
    );
    expect(html).toContain(platformReportCopy(locale).unavailable);
    expect(html).toContain(platformReportCopy(locale).retry);
    expect(html).toContain('href="/users/alice"');
    expect(html).not.toContain("/auth/login");
    expect(html).not.toContain(platformReportCopy(locale).reportSignIn);
  },
);

vi.mock("../../src/features/shell/guest-auth", () => ({
  GuestAuthLinks: ({ signInLabel }: { signInLabel: string }) => (
    <a href="/auth/login">{signInLabel}</a>
  ),
}));

it("shows guest auth for anonymous reporters and the submit control when signed in", () => {
  const copy = platformReportCopy("en");
  const guest = renderToStaticMarkup(
    <ObjectReportForm
      targetType="product"
      targetId="prd_hud"
      locale="en"
      authenticated={false}
      loginHref="/auth/login?return=/market/hud"
      registerHref="/auth/register?return=/market/hud"
    />,
  );
  expect(guest).toContain(copy.reportSignIn);
  expect(guest).toContain(copy.reportSignInAction);

  const member = renderToStaticMarkup(
    <ObjectReportForm
      targetType="server"
      targetId="srv_city"
      locale="ru"
      authenticated
      loginHref="/auth/login"
      registerHref="/auth/register"
    />,
  );
  expect(member).toContain(platformReportCopy("ru").report);
  expect(member).not.toContain(platformReportCopy("ru").reportSignIn);
});
