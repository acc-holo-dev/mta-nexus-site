import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../apps/web/src/lib/i18n";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("localized legal and workspace shell", () => {
  it("serves legal pages from one RU/EN document system", () => {
    for (const [path, key] of [
      ["apps/web/src/app/terms/page.tsx", "terms"],
      ["apps/web/src/app/privacy/page.tsx", "privacy"],
      ["apps/web/src/app/copyright/page.tsx", "copyright"],
    ] as const) {
      const page = read(path);
      expect(page).toContain("getRequestLocale");
      expect(page).toContain(`.legal.${key}`);
      expect(page).toContain("<LegalDocument");
    }

    const en = getDictionary("en").legal;
    const ru = getDictionary("ru").legal;
    expect(en.terms.title).not.toBe(ru.terms.title);
    expect(en.privacy.title).not.toBe(ru.privacy.title);
    expect(en.copyright.title).not.toBe(ru.copyright.title);
  });

  it("uses the shared locale provider for route errors and loading", () => {
    const error = read("apps/web/src/app/error.tsx");
    const loading = read("apps/web/src/app/loading.tsx");

    expect(error).toContain("useNexusLocale");
    expect(error).not.toContain("document.cookie");
    expect(error).not.toContain("resolveLocale");
    expect(loading).toContain("useNexusLocale");
    expect(loading).toContain("dictionary.errors.loading");

    const en = getDictionary("en").errors.loading;
    const ru = getDictionary("ru").errors.loading;
    expect(en).not.toBe(ru);
  });

  it("keeps workspace live status authoritative and localized", () => {
    const workspace = read("apps/web/src/app/workspace/page.tsx");

    expect(workspace).toContain(
      "mtaMasterDirectoryService.getDirectory().catch(() => null)",
    );
    expect(workspace).toContain("matchesMtaEndpoint(server, observation)");
    expect(workspace).toContain("dictionary.servers.online");
    expect(workspace).toContain("dictionary.servers.offline");
    expect(workspace).toContain("dictionary.servers.unknown");
    expect(workspace).not.toContain("bg-blue-600");
    expect(workspace).not.toContain("bg-emerald-600");
    expect(workspace).not.toContain("text-neutral-");
  });
});
