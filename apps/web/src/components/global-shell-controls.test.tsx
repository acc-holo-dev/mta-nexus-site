import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../lib/i18n";

import { LocaleProvider } from "./locale-context";
import { ThemeToggle } from "./theme-toggle";


const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("global shell controls", () => {
  it("uses ordinary Discover navigation instead of command-driven shell search", () => {
    const navbar = read("apps/web/src/components/navbar.tsx");
    const shell = read("apps/web/src/components/nexus-shell.tsx");
    const trigger = navbar.slice(navbar.indexOf("function NavbarSearchTrigger"));

    expect(trigger).toContain('href="/discover"');
    expect(trigger).toContain("aria-label={placeholder}");
    expect(trigger).not.toContain("onClick=");
    expect(shell).not.toContain("CommandPalette");
    expect(shell).not.toContain("Control+k");
  });

  it("localizes account controls and protects session mutations", () => {
    const source = read("apps/web/src/components/account-controls.tsx");

    expect(source).toContain("dictionary.accountControls");
    expect(source.match(/credentials: "same-origin"/g)?.length).toBe(2);
    expect(source.match(/cache: "no-store"/g)?.length).toBe(2);
    expect(source).toContain("AbortSignal.timeout(10_000)");
    expect(source).toContain("data?.success !== true");

    const en = getDictionary("en").accountControls;
    const ru = getDictionary("ru").accountControls;
    expect(en.signOut).not.toBe(ru.signOut);
    expect(en.checkError).not.toBe(ru.checkError);
  });

  it("does not mark notifications read before the server confirms success", () => {
    const source = read("apps/web/src/components/notification-bell.tsx");

    expect(source).toContain("dictionary.notificationBell");
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain("data?.success !== true");
    const markAllRead = source.slice(source.indexOf("async function markAllRead()"), source.indexOf("const bellLabel"));
    expect(markAllRead).toContain("setAttempt((value) => value + 1)");
    expect(markAllRead).not.toContain("setUnreadCount(0)");
    expect(source).toContain("<dialog");

    const en = getDictionary("en").notificationBell;
    const ru = getDictionary("ru").notificationBell;
    expect(en.markAllRead).not.toBe(ru.markAllRead);
    expect(en.loadError).not.toBe(ru.loadError);
  });

  it.each(["en", "ru"] as const)("renders the theme control with an accessible localized name in %s", (locale) => {
    const html = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <ThemeToggle />
      </LocaleProvider>,
    );
    expect(html).toContain('type="button"');
    expect(html).toContain(`aria-label="${getDictionary(locale).theme.switchToLight}"`);
    expect(html).toContain('aria-hidden="true"');
  });
});
