import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../apps/web/src/lib/i18n";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("pre-release shell accessibility", () => {
  it("provides a localized skip link and focusable main landmark", () => {
    const shell = read("apps/web/src/components/nexus-shell.tsx");
    const en = getDictionary("en");
    const ru = getDictionary("ru");

    expect(shell).toContain('href="#main-content"');
    expect(shell).toContain('id="main-content"');
    expect(shell).toContain("tabIndex={-1}");
    expect(shell).toContain("dictionary.nav.skipToContent");
    expect(en.nav.skipToContent).not.toBe(ru.nav.skipToContent);
  });

  it("keeps mobile navigation touch-sized and keyboard visible", () => {
    const mobile = read("apps/web/src/components/mobile-nav.tsx");

    expect(mobile).toContain("min-h-12");
    expect(mobile).toContain("focus-visible:outline-2");
    expect(mobile).toContain('aria-current={active ? "page" : undefined}');
    expect(mobile).toContain('aria-hidden="true"');
  });

  it("gives collapsed sidebar links accessible names", () => {
    const sidebar = read("apps/web/src/components/sidebar.tsx");

    expect(sidebar).toContain(
      "aria-label={isCollapsed ? item.label : undefined}",
    );
    expect(sidebar).toContain(
      "aria-label={isCollapsed ? dictionary.nav.admin : undefined}",
    );
    expect(sidebar).toContain("focus-visible:outline-2");
  });

  it("uses compact account controls on narrow headers without removing labels", () => {
    const account = read("apps/web/src/components/account-controls.tsx");
    const locale = read("apps/web/src/components/locale-switcher.tsx");
    const navbar = read("apps/web/src/components/navbar.tsx");

    expect(account).toContain('className="hidden max-w-24 truncate sm:block"');
    expect(account).toContain("sr-only sm:hidden");
    expect(account).toContain("UserRound");
    expect(account).toContain("LogOut");
    expect(locale).toContain("nextLocale.toUpperCase()");
    expect(locale).toContain('className="sm:hidden"');
    expect(navbar).toContain("gap-1.5 sm:gap-2");
  });

  it("does not optimistically mark the notification center read", () => {
    const page = read("apps/web/src/app/notifications/page.tsx");

    expect(page).toContain("data?.success !== true");
    const markAllRead = page.slice(page.indexOf("async function markAllRead()"), page.indexOf("const filtered ="));
    expect(markAllRead).toContain("await loadNotifications()");
    expect(markAllRead).not.toContain("setNotifications((previous)");
    expect(page).toContain('role="tablist"');
    expect(page).toContain("aria-label={copy.title}");
  });
});
