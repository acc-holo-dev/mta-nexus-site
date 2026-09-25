import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary, resolveLocale } from "../apps/web/src/lib/i18n";

describe("RU/EN shell foundation", () => {
  it("resolves only supported locales", () => {
    expect(resolveLocale("ru")).toBe("ru");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("de")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });

  it("provides translated core navigation and home copy", () => {
    const en = getDictionary("en");
    const ru = getDictionary("ru");

    expect(en.nav.liveServers).not.toBe(ru.nav.liveServers);
    expect(en.home.title).not.toBe(ru.home.title);
    expect(en.footer.summary).not.toBe(ru.footer.summary);
  });

  it("keeps mobile navigation and locale switching in the global shell", () => {
    const shell = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/nexus-shell.tsx"),
      "utf8",
    );
    const layout = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/layout.tsx"),
      "utf8",
    );

    expect(shell).toContain("<MobileNav locale={locale} />");
    expect(layout).toContain("<NexusShell locale={locale}>");
    expect(layout).toContain("<html lang={locale}");
  });
});
