import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../lib/i18n";

import { LocaleProvider } from "./locale-context";
import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("global shell controls", () => {
  // Shortcut, focus containment and keyboard activation are exercised by
  // shell-accessibility.playwright.mjs rather than JavaScript spelling checks.
  it.each(["en", "ru"] as const)("renders accessible localized palette commands in %s", (locale) => {
    const copy = getDictionary(locale).commandPalette;
    const renderPalette = (isOpen: boolean) => renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <CommandPalette isOpen={isOpen} onClose={() => undefined} />
      </LocaleProvider>,
    );
    expect(renderPalette(false)).toBe("");
    const html = renderPalette(true);
    expect(html).toContain(`aria-label="${copy.dialogLabel}"`);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-modal="true"');
    for (const label of [copy.goMarket, copy.goServers, copy.openSaved, copy.openSettings]) {
      expect(html).toContain(label);
    }
  });

  it("uses localized command copy and abortable uncached search requests", () => {
    const palette = read("apps/web/src/components/command-palette.tsx");

    expect(palette).toContain("dictionary.commandPalette");
    expect(palette).toContain('cache: "no-store"');
    expect(palette).toContain('credentials: "same-origin"');
    expect(palette).toContain("controller.abort()");
    expect(palette).toContain('aria-modal="true"');

    const en = getDictionary("en").commandPalette;
    const ru = getDictionary("ru").commandPalette;
    expect(en.goMarket).not.toBe(ru.goMarket);
    expect(en.searchPlaceholder).not.toBe(ru.searchPlaceholder);
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
