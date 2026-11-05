import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ReverseDependencyList } from "../apps/web/src/components/reverse-dependency-list";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/reverse-dependency-list.tsx"),
  "utf8",
);

it("locks reverse-dependency limitReached to ErrorState without soft warning", () => {
  expect(source).toContain('import { EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain("<ErrorState title={copy.reverseUnavailable} />");
  expect(source).toContain(
    '<ErrorState id="reverse-deps-limit-reached" title={copy.limitReached} />',
  );
  expect(source).not.toContain(
    '<p className="text-[10px] text-warning">{copy.limitReached}</p>',
  );
  expect(source).not.toMatch(/limitReached[\s\S]{0,120}action=/u);
});

it.each(["en", "ru"] as const)(
  "renders limitReached through shared ErrorState chrome in %s",
  (locale) => {
    const copy = getDictionary(locale).dependencyUi;
    const markup = renderToStaticMarkup(
      <ReverseDependencyList
        locale={locale}
        summary={{
          totalVisible: 1,
          limitReached: true,
          products: [
            {
              id: "prd_1",
              slug: "vehicle-core",
              title: "Vehicle Core",
              type: "script",
              currentVersion: "2.4.0",
            },
          ],
        }}
      />,
    );

    expect(markup).toContain(copy.limitReached);
    expect(markup).toContain('id="reverse-deps-limit-reached"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("bg-danger-soft");
    expect(markup).not.toContain('class="text-[10px] text-warning"');
    expect(markup).not.toContain("Retry");
    expect(markup).not.toContain("Повторить");
  },
);
