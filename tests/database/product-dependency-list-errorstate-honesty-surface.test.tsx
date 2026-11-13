import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getDictionary } from "../../site/src/lib/i18n";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ProductDependencyList } from "../../site/src/components/product-dependency-list";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/components/product-dependency-list.tsx"), "utf8");

it("locks null catalogue resolution to ErrorState without inventing retry", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain("<ErrorState title={copy.resolutionUnavailable} />");
  expect(source).not.toMatch(/text-\[10px\] text-warning>\{\s*copy\.resolutionUnavailable\s*\}/u);
  expect(source).not.toMatch(/ErrorState[\s\S]*action=/u);
});

it("locks self_reference soft warning to ErrorState without inventing retry", () => {
  expect(source).toContain(
    "<ErrorState title={copy.selfReference} description={dependencyItem.slug} />",
  );
  expect(source).not.toContain('font-mono text-warning">{dependencyItem.slug}');
  expect(source).not.toContain('text-[10px] text-warning">{copy.selfReference}');
  expect(source).not.toMatch(/ErrorState[\s\S]*action=/u);
});

it("locks unresolved catalogue miss to ErrorState without inventing retry", () => {
  expect(source).toContain('id="product-dependency-not-found"');
  expect(source).toContain("<ErrorState");
  expect(source).toContain("title={copy.notFound}");
  expect(source).toContain("description={dependencyItem.slug}");
  expect(source).not.toContain('text-[10px] text-faint">{copy.notFound}');
  expect(source).not.toMatch(/id="product-dependency-not-found"[\s\S]*action=/u);
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

it.each(["en", "ru"] as const)(
  "renders self_reference through shared ErrorState chrome in %s",
  (locale) => {
    const copy = getDictionary(locale).dependencyUi;
    const markup = renderToStaticMarkup(
      <ProductDependencyList
        declared={["vehicle-pack"]}
        resolution={{
          declaredCount: 1,
          availableCount: 0,
          unresolvedCount: 0,
          selfReferenceCount: 1,
          dependencies: [
            {
              slug: "vehicle-pack",
              status: "self_reference",
              product: null,
            },
          ],
        }}
        locale={locale}
      />,
    );

    expect(markup).toContain(copy.selfReference);
    expect(markup).toContain("vehicle-pack");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("bg-danger-soft");
    expect(markup).not.toContain('class="font-mono text-warning"');
    expect(markup).not.toContain('class="text-[10px] text-warning"');
    expect(markup).not.toContain("Retry");
    expect(markup).not.toContain("Повторить");
  },
);

it.each(["en", "ru"] as const)(
  "renders unresolved miss through shared ErrorState chrome in %s",
  (locale) => {
    const copy = getDictionary(locale).dependencyUi;
    const markup = renderToStaticMarkup(
      <ProductDependencyList
        declared={["missing-pack"]}
        resolution={{
          declaredCount: 1,
          availableCount: 0,
          unresolvedCount: 1,
          selfReferenceCount: 0,
          dependencies: [
            {
              slug: "missing-pack",
              status: "unresolved",
              product: null,
            },
          ],
        }}
        locale={locale}
      />,
    );

    expect(markup).toContain(copy.notFound);
    expect(markup).toContain("missing-pack");
    expect(markup).toContain('id="product-dependency-not-found"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("bg-danger-soft");
    expect(markup).not.toMatch(/text-\[10px\] text-faint[^>]*>\s*(?:не найдено|not found)/iu);
    expect(markup).not.toContain("Retry");
    expect(markup).not.toContain("Повторить");
  },
);
