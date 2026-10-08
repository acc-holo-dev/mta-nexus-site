import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../lib/i18n";
import { LocaleProvider } from "./locale-context";
import { AccountControls } from "./account-controls";
import { Navbar } from "./navbar";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

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

describe("global shell controls behavior", () => {
  beforeEach(() => {
    nav.pathname = "/";
  });

  it.each(["en", "ru"] as const)(
    "renders ordinary localized Discover search navigation in %s",
    (locale) => {
      const dictionary = getDictionary(locale);
      const html = renderToStaticMarkup(
        React.createElement(Navbar, { locale }),
      );

      expect(html).toMatch(
        new RegExp(
          `<a[^>]*href="/discover"[^>]*aria-label="${dictionary.nav.search}"`,
          "u",
        ),
      );
    },
  );

  it.each(["en", "ru"] as const)(
    "renders account session checking as a localized live status in %s",
    (locale) => {
      const dictionary = getDictionary(locale);
      const html = renderToStaticMarkup(
        React.createElement(
          LocaleProvider,
          { locale },
          React.createElement(AccountControls),
        ),
      );

      expect(html).toContain('role="status"');
      expect(html).toContain(dictionary.accountControls.checking);
    },
  );

  it.each(["en", "ru"] as const)(
    "renders a closed notification trigger with a localized accessible name in %s",
    (locale) => {
      const dictionary = getDictionary(locale);
      const html = renderToStaticMarkup(
        React.createElement(
          LocaleProvider,
          { locale },
          React.createElement(NotificationBell),
        ),
      );

      expect(html).toContain(
        `aria-label="${dictionary.notificationBell.title}"`,
      );
      expect(html).toContain('aria-expanded="false"');
      expect(html).not.toContain('aria-controls="notification-popover"');
      expect(html).not.toContain('id="notification-popover"');
    },
  );

  it.each(["en", "ru"] as const)(
    "renders the theme control with an accessible localized name in %s",
    (locale) => {
      const html = renderToStaticMarkup(
        React.createElement(
          LocaleProvider,
          { locale },
          React.createElement(ThemeToggle),
        ),
      );
      expect(html).toContain('type="button"');
      expect(html).toContain(
        `aria-label="${getDictionary(locale).theme.switchToLight}"`,
      );
      expect(html).toContain('aria-hidden="true"');
    },
  );

  it("keeps RU and EN account/notification copy distinct", () => {
    const en = getDictionary("en");
    const ru = getDictionary("ru");

    expect(en.accountControls.signOut).not.toBe(
      ru.accountControls.signOut,
    );
    expect(en.notificationBell.markAllRead).not.toBe(
      ru.notificationBell.markAllRead,
    );
  });
});
