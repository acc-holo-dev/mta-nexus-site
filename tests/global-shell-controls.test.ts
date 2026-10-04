import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../apps/web/src/lib/i18n";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("global shell controls", () => {
  it("opens the command palette from Ctrl/Cmd+K and keeps closed-beta navigation clean", () => {
    const navbar = read("apps/web/src/components/navbar.tsx");
    const palette = read("apps/web/src/components/command-palette.tsx");

    expect(navbar).toContain("event.metaKey || event.ctrlKey");
    expect(navbar).toContain('event.key.toLowerCase() === "k"');
    expect(navbar).toContain("setIsSearchOpen((open) => !open)");
    expect(navbar).toContain('aria-haspopup="dialog"');

    expect(palette).toContain('router.push("/market")');
    expect(palette).toContain('router.push("/servers")');
    expect(palette).toContain('router.push("/workspace/saved")');
    expect(palette).toContain('router.push("/settings")');
    expect(palette).not.toContain("/workspace/purchases");
    expect(palette).not.toContain("/workspace/licenses");
    expect(palette).not.toContain("CreditCard");
    expect(palette).not.toContain("Key,");
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

  it("localizes theme control accessibility labels", () => {
    const source = read("apps/web/src/components/theme-toggle.tsx");

    expect(source).toContain("dictionary.theme");
    expect(source).toContain("copy.switchToLight");
    expect(source).toContain("copy.switchToDark");

    const en = getDictionary("en").theme;
    const ru = getDictionary("ru").theme;
    expect(en.switchToLight).not.toBe(ru.switchToLight);
    expect(en.switchToDark).not.toBe(ru.switchToDark);
  });
});
