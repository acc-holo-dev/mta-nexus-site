import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ locale: "en" as "en" | "ru" }));

vi.mock("next/script", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      id,
      strategy,
      dangerouslySetInnerHTML,
    }: {
      id: string;
      strategy: string;
      dangerouslySetInnerHTML?: { __html?: string };
    }) =>
      ReactModule.createElement("script", {
        id,
        "data-strategy": strategy,
        dangerouslySetInnerHTML,
      }),
  };
});

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => runtime.locale,
}));

vi.mock("../apps/web/src/components/nexus-shell", async () => {
  const ReactModule = await import("react");
  return {
    NexusShell: ({ children, locale }: { children?: React.ReactNode; locale: string }) =>
      ReactModule.createElement("main", { "data-shell-locale": locale }, children),
  };
});

vi.mock("../apps/web/src/components/pwa-service-worker", async () => {
  const ReactModule = await import("react");
  return {
    PwaServiceWorker: () => ReactModule.createElement("span", { "data-pwa": "registered" }),
  };
});

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

import RootLayout from "../apps/web/src/app/layout";
import GlobalError, { detectGlobalErrorLocale } from "../apps/web/src/app/global-error";
import ErrorPage from "../apps/web/src/app/error";
import NotFound from "../apps/web/src/app/not-found";
import { LocaleProvider } from "../apps/web/src/components/locale-context";
import { getDictionary } from "../apps/web/src/lib/i18n";

function executeThemeScript(
  source: string,
  preference: "light" | "dark" | "system" | null,
  prefersDark: boolean,
) {
  let dark = false;
  vm.runInNewContext(source, {
    localStorage: {
      getItem: () => preference,
    },
    window: {
      matchMedia: () => ({ matches: prefersDark }),
    },
    document: {
      documentElement: {
        classList: {
          toggle: (name: string, enabled: boolean) => {
            if (name === "dark") dark = enabled;
          },
        },
      },
    },
  });
  return dark;
}

describe("Next.js root runtime shell behavior", () => {
  beforeEach(() => {
    runtime.locale = "en";
  });

  it.each(["en", "ru"] as const)(
    "propagates %s locale through the root document and shell",
    async (locale) => {
      runtime.locale = locale;
      const element = await RootLayout({
        children: React.createElement("p", null, "Child"),
      });
      const html = renderToStaticMarkup(element);

      expect(html).toMatch(new RegExp(`^<html lang="${locale}"`, "u"));
      expect(html).toContain(`data-shell-locale="${locale}"`);
      expect(html).toContain('data-pwa="registered"');
    },
  );

  it("renders a beforeInteractive theme bootstrap that applies stored/system preference", async () => {
    const element = await RootLayout({
      children: React.createElement("p", null, "Child"),
    });
    const html = renderToStaticMarkup(element);
    const match = html.match(
      /<script[^>]*id="nexus-theme-init"[^>]*data-strategy="beforeInteractive"[^>]*>([\s\S]*?)<\/script>/u,
    );

    expect(match?.[1]).toBeTruthy();
    const source = match?.[1] ?? "";

    expect(executeThemeScript(source, "light", true)).toBe(false);
    expect(executeThemeScript(source, "dark", false)).toBe(true);
    expect(executeThemeScript(source, "system", true)).toBe(true);
    expect(executeThemeScript(source, "system", false)).toBe(false);
  });

  it("parses the root-error locale cookie without shell context", () => {
    expect(detectGlobalErrorLocale("foo=1; nexus_locale=ru; bar=2")).toBe("ru");
    expect(detectGlobalErrorLocale("nexus_locale=en")).toBe("en");
    expect(detectGlobalErrorLocale("")).toBe("en");
  });

  it("renders a self-contained root error document with retry and home actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalError, {
        error: new Error("boom"),
        reset: () => undefined,
      }),
    );

    expect(html).toMatch(/^<html lang="en">/u);
    expect(html).toContain("<body");
    expect(html).toContain("<main");
    expect(html).toContain(">Try again</button>");
    expect(html).toContain('href="/"');
    expect(html).toContain(">Home</a>");
  });

  it.each(["en", "ru"] as const)(
    "renders regular error actions with localized accessible text in %s",
    (locale) => {
      const dictionary = getDictionary(locale);
      const html = renderToStaticMarkup(
        <LocaleProvider locale={locale}>
          <ErrorPage error={new Error("route")} reset={() => undefined} />
        </LocaleProvider>,
      );

      expect(html).toContain(`>${dictionary.errors.retry}</span>`);
      expect(html).toContain(`>${dictionary.errors.home}</span>`);
      expect(html).toContain('href="/"');
      expect(html.match(/aria-hidden="true"/gu)?.length).toBeGreaterThanOrEqual(2);
    },
  );

  it.each(["en", "ru"] as const)(
    "renders not-found recovery destinations in %s",
    async (locale) => {
      runtime.locale = locale;
      const dictionary = getDictionary(locale);
      const element = await NotFound();
      const html = renderToStaticMarkup(element);

      expect(html).toContain(dictionary.errors.notFoundTitle);
      expect(html).toContain('href="/market"');
      expect(html).toContain(dictionary.errors.resourceLibrary);
      expect(html).toContain('href="/"');
      expect(html).toContain(dictionary.errors.home);
      expect(html.match(/aria-hidden="true"/gu)?.length).toBeGreaterThanOrEqual(3);
    },
  );
});
