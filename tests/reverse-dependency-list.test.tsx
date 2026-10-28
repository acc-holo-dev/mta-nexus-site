import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ReverseDependencyList } from "../apps/web/src/components/reverse-dependency-list";

describe("reverse dependency list behavior", () => {
  it.each(["en", "ru"] as const)(
    "renders explicit unavailable and empty states in %s",
    (locale) => {
      const copy = getDictionary(locale).dependencyUi;

      expect(
        renderToStaticMarkup(<ReverseDependencyList summary={null} locale={locale} />),
      ).toContain(copy.reverseUnavailable);

      expect(
        renderToStaticMarkup(
          <ReverseDependencyList
            summary={{
              totalVisible: 0,
              limitReached: false,
              products: [],
            }}
            locale={locale}
          />,
        ),
      ).toContain(copy.noDependents);
    },
  );

  it("renders bounded dependents as links without claiming compatibility", () => {
    const copy = getDictionary("en").dependencyUi;
    const markup = renderToStaticMarkup(
      <ReverseDependencyList
        locale="en"
        summary={{
          totalVisible: 2,
          limitReached: true,
          products: [
            {
              id: "prd_1",
              slug: "vehicle-core",
              title: "Vehicle Core",
              type: "script",
              currentVersion: "2.4.0",
            },
            {
              id: "prd_2",
              slug: "hud-pack",
              title: "HUD Pack",
              type: "ui",
              currentVersion: "1.3.0",
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('href="/market/vehicle-core"');
    expect(markup).toContain('href="/market/hud-pack"');
    expect(markup).toContain("Vehicle Core");
    expect(markup).toContain("v2.4.0");
    expect(markup).toContain(copy.limitReached);
    expect(markup).toContain(copy.reverseNotice);
    expect(markup).not.toMatch(/compatible with|guaranteed compatible|verified compatible/iu);
  });
});
