import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { GuestAuthLinks, platformSignInFocusClass } from "../../src/components/guest-auth-links";

it("renders paired login and register links with shared focus styling", () => {
  const html = renderToStaticMarkup(
    <GuestAuthLinks
      loginHref="/auth/login?next=%2F"
      registerHref="/auth/register?next=%2F"
      signInLabel="Sign in"
      createAccountLabel="Create account"
    />,
  );
  expect(html).toContain('href="/auth/login?next=%2F"');
  expect(html).toContain('href="/auth/register?next=%2F"');
  expect(html).toContain("Sign in");
  expect(html).toContain("Create account");
  expect(html).toContain("bg-accent");
  expect(html).toContain(platformSignInFocusClass);
});
