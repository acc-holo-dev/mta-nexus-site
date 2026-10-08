import { describe, expect, it } from "vitest";
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
    expect(en.market.title).not.toBe(ru.market.title);
    expect(en.workspace.title).not.toBe(ru.workspace.title);
    expect(en.servers.title).not.toBe(ru.servers.title);
    expect(en.auth.loginTitle).not.toBe(ru.auth.loginTitle);
    expect(en.product.addToLibrary).not.toBe(ru.product.addToLibrary);
    expect(en.checkout.title).not.toBe(ru.checkout.title);
    expect(en.admin.title).not.toBe(ru.admin.title);
    expect(en.dev.title).not.toBe(ru.dev.title);
    expect(en.nav.devTools).not.toBe(ru.nav.devTools);
    expect(en.checkout.title).toBe("Add resource to library");
    expect(en.checkout.addToLibrary).toBe("Add to library");
    expect(en.checkout.resourceAdded).toBe("Resource added");
    expect(en.checkout.openResource).toBe("Open resource");
    expect(en.product.downloadBuild).toBe("Download Build");
    expect(en.product.inLibrary).toBe("In your library");
    expect(en.product.addToLibrary).toBe("Add to library");
  });

  it("keeps Russian and English dictionary keys in sync", () => {
    function keys(value: unknown, prefix = ""): string[] {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      return Object.entries(value).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return [path, ...keys(child, path)];
      }).sort();
    }

    expect(keys(getDictionary("ru"))).toEqual(keys(getDictionary("en")));
    expect(getDictionary("ru").workspaceContext.retry).toBe("Повторить");
    expect(getDictionary("en").workspaceContext.retry).toBe("Try again");
  });

});
