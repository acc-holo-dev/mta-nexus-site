import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagedServerCard } from "../apps/web/src/components/managed-server-card";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { getManagedServerCopy } from "../apps/web/src/lib/managed-server-view";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("localized legal and workspace shell", () => {
  it("serves legal pages from one RU/EN document system", () => {
    for (const [path, key] of [
      ["apps/web/src/app/terms/page.tsx", "terms"],
      ["apps/web/src/app/privacy/page.tsx", "privacy"],
      ["apps/web/src/app/copyright/page.tsx", "copyright"],
      ["apps/web/src/app/community-rules/page.tsx", "communityRules"],
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
    expect(en.communityRules.title).not.toBe(ru.communityRules.title);
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
    const server = {
      id: "server",
      name: "Server",
      slug: "server",
      ipAddress: "203.0.113.7",
      port: 22003,
      organizationId: null,
      visibility: "public",
      status: "maintenance",
      isVerified: true,
      updatedAt: new Date("2026-10-09T12:00:00Z"),
    };
    const observation = {
      address: server.ipAddress,
      port: server.port,
      responding: true,
      players: 99,
    };
    for (const locale of ["en", "ru"] as const) {
      const copy = getManagedServerCopy(locale);
      for (const [observed, stale, status] of [
        [observation, false, "online"],
        [{ ...observation, responding: false, players: 0 }, false, "offline"],
        [undefined, false, "unknown"],
        [observation, true, "unknown"],
      ] as const) {
        const html = renderToStaticMarkup(
          ManagedServerCard({ server, observation: observed, isStale: stale, locale }),
        );
        expect(html).toContain(copy[status]);
        expect(html).toContain(copy.maintenance);
        if (stale) expect(html).not.toContain("99");
        expect(html).not.toContain("bg-blue-600");
        expect(html).not.toContain("bg-emerald-600");
        expect(html).not.toContain("text-neutral-");
      }
    }
  });
});
