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

import { ProductDependencyList } from "../apps/web/src/components/product-dependency-list";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/product-dependency-list.tsx"),
  "utf8",
);

it("locks null catalogue resolution to ErrorState without inventing retry", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain("<ErrorState title={copy.resolutionUnavailable} />");
  expect(source).not.toMatch(/text-\[10px\] text-warning>\{\s*copy\.resolutionUnavailable\s*\}/u);
  expect(source).not.toMatch(/ErrorState[\s\S]*action=/u);
});

it.each(["en", "ru"] as const)(
  "renders resolutionUnavailable through shared ErrorState chrome in %s",
  (locale) => {
    const copy = getDictionary(locale).dependencyUi;
    const markup = renderToStaticMarkup(
      <ProductDependencyList
        declared={["core-ui", "missing-pack"]}
        resolution={null}
        locale={locale}
      />,
    );

    expect(markup).toContain(copy.resolutionUnavailable);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("bg-danger-soft");
    expect(markup).not.toContain("core-ui, missing-pack");
    expect(markup).not.toContain('class="text-[10px] text-warning"');
    expect(markup).not.toContain("Retry");
    expect(markup).not.toContain("Повторить");
  },
);
