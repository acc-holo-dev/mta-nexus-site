import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary, type Locale } from "../lib/i18n";
import {
  PlatformWorkspaceGuestAuthLinks,
  PlatformWorkspaceSignInCopy,
} from "./platform-workspace-guest-auth";

describe("PlatformWorkspaceGuestAuthLinks", () => {
  it.each(["en", "ru"] as Locale[])(
    "builds login and register hrefs with a safe return path in %s",
    (locale) => {
      const workspace = getDictionary(locale).workspace;
      const html = renderToStaticMarkup(
        createElement(PlatformWorkspaceGuestAuthLinks, {
          locale,
          returnPath: "/acquire?productId=prd_a",
        }),
      );
      expect(html).toContain("/auth/login?next=%2Facquire%3FproductId%3Dprd_a");
      expect(html).toContain("/auth/register?next=%2Facquire%3FproductId%3Dprd_a");
      expect(html).toContain(workspace.signIn);
      expect(html).toContain(workspace.createAccount);
    },
  );

  it("omits next when return path is unsafe", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformWorkspaceGuestAuthLinks, {
        locale: "en",
        returnPath: "https://evil.example/phish",
      }),
    );
    expect(html).toContain('href="/auth/login"');
    expect(html).toContain('href="/auth/register"');
    expect(html).not.toContain("next=");
  });
});

describe("PlatformWorkspaceSignInCopy", () => {
  it.each(["en", "ru"] as Locale[])("renders page-title sign-in copy in %s", (locale) => {
    const workspace = getDictionary(locale).workspace;
    const html = renderToStaticMarkup(
      createElement(PlatformWorkspaceSignInCopy, { locale, variant: "page-title" }),
    );
    expect(html).toContain("<h1");
    expect(html).toContain(workspace.signInRequired);
    expect(html).toContain(workspace.signInMessage);
  });

  it.each(["en", "ru"] as Locale[])(
    "renders panel sign-in copy without a heading in %s",
    (locale) => {
      const workspace = getDictionary(locale).workspace;
      const html = renderToStaticMarkup(
        createElement(PlatformWorkspaceSignInCopy, { locale, variant: "panel" }),
      );
      expect(html).not.toContain("<h1");
      expect(html).toContain(workspace.signInRequired);
      expect(html).toContain(workspace.signInMessage);
    },
  );
});
