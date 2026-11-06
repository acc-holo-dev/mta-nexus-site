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

it("locks reverse-dependency null summary to ErrorState without inventing retry", () => {
  expect(source).toContain('import { EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain(
    '<ErrorState id="reverse-deps-unavailable" title={copy.reverseUnavailable} />',
  );
  expect(source).not.toContain("<ErrorState title={copy.reverseUnavailable} />");
  expect(source).not.toMatch(/id="reverse-deps-unavailable"[\s\S]*action=/u);
});

it.each(["en", "ru"] as const)(
  "renders reverseUnavailable through shared ErrorState chrome in %s",
  (locale) => {
    const copy = getDictionary(locale).dependencyUi;
    const markup = renderToStaticMarkup(<ReverseDependencyList summary={null} locale={locale} />);

    expect(markup).toContain(copy.reverseUnavailable);
    expect(markup).toContain('id="reverse-deps-unavailable"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("bg-danger-soft");
    expect(markup).not.toContain("Retry");
    expect(markup).not.toContain("Повторить");
  },
);
