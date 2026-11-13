import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ObjectReportForm } from "../site/src/components/object-report-form";
import { platformReportCopy } from "../site/src/lib/platform-report-i18n";

vi.mock("@nexus/ui", async () => {
  const React = await import("react");
  return {
    Button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) =>
      React.createElement("button", props, children),
    ErrorState: ({ title }: { title: string }) =>
      React.createElement("div", { role: "alert" }, title),
  };
});

vi.mock("../site/src/components/guest-auth-links", () => ({
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
