import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../site/src/lib/i18n";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

import { ManagedServerVisibilityBatch } from "../site/src/components/managed-server-visibility-batch";
import { MtaMasterServerDirectory } from "../site/src/components/mta-master-server-directory";
import { serverWorkspaceCopy } from "../site/src/lib/server-workspace-copy";

describe("MTA directory/visibility chrome", () => {
  it("renders directory controls with shared Button chrome", () => {
    const copy = getDictionary("en").servers;
    const html = renderToStaticMarkup(createElement(MtaMasterServerDirectory, { locale: "en" }));
    expect(html).toContain(copy.directory);
    expect(html).toContain(`<search aria-label="${copy.search}"`);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("rounded-lg");
  });

  it.each(["en", "ru"] as const)(
    "names directory client filters with a localized search landmark in %s",
    (locale) => {
      const copy = getDictionary(locale).servers;
      const html = renderToStaticMarkup(createElement(MtaMasterServerDirectory, { locale }));
      expect(html).toContain(`<search aria-label="${copy.search}"`);
      expect(html).toContain(copy.minimumPlayers);
      expect(html).toContain(copy.searchPlaceholder);
    },
  );

  it("locks directory resetFilters CTA to size=touch", () => {
    const source = read("site/src/components/mta-master-server-directory.tsx");
    expect(source).toContain("onClick={resetFilters}");
    expect(source).toMatch(
      /size="touch"[\s\S]{0,80}?onClick=\{resetFilters\}|onClick=\{resetFilters\}[\s\S]{0,80}?size="touch"/u,
    );
    expect(source).not.toContain("min-h-10");
  });

  it("locks remaining directory Buttons to size=touch and empty results to EmptyState", () => {
    const source = read("site/src/components/mta-master-server-directory.tsx");
    expect(source).toContain("EmptyState");
    expect(source).toContain("copy.noMatchDescription");
    expect(source).toContain("copy.noneDescription");
    expect(source).toMatch(/title=\{hasFilters \? copy\.noMatch : copy\.none\}/u);
    expect(source).toMatch(
      /description=\{hasFilters \? copy\.noMatchDescription : copy\.noneDescription\}/u,
    );
    expect(source).not.toContain('size="sm"');
    expect(source).not.toContain("nexus-panel space-y-3 p-6 text-center");
    expect(source.match(/size="touch"/gu)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it.each(["en", "ru"] as const)(
    "keeps additive directory empty honesty descriptions in %s",
    (locale) => {
      const copy = getDictionary(locale).servers;
      expect(copy.noMatchDescription.length).toBeGreaterThan(20);
      expect(copy.noneDescription.length).toBeGreaterThan(20);
      expect(copy.noMatchDescription).not.toBe(copy.noneDescription);
      expect(copy.noMatchDescription).not.toBe(copy.noMatch);
      expect(copy.noneDescription).not.toBe(copy.none);
    },
  );

  it.each(["en", "ru"] as const)(
    "renders visibility batch actions with shared Button chrome in %s",
    (locale) => {
      const copy = serverWorkspaceCopy(locale);
      const html = renderToStaticMarkup(
        createElement(ManagedServerVisibilityBatch, {
          locale,
          items: [{ id: "srv_a", name: "Alpha", card: "card" }],
        }),
      );
      expect(html).toContain(copy.selectAll);
      expect(html).toContain(copy.preview);
      expect(html).toContain("rounded-lg");
      expect(html).toContain("text-accent");
    },
  );
});
