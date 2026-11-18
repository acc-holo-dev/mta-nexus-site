import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HonestLoadingShell } from "../../src/features/shell/honest-loading";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks Shell honest-loading port export and migrated route consumers", () => {
  const port = read("site/src/features/shell/honest-loading.ts");
  expect(port).toContain('export { HonestLoadingShell } from "./components/honest-loading-shell"');
  expect(port).not.toMatch(/^"use client";/m);

  const shell = read("site/src/features/shell/components/honest-loading-shell.tsx");
  expect(shell).toContain('aria-busy="true"');
  expect(shell).toContain('role="status"');
  expect(shell).toContain('aria-live="polite"');
  expect(shell).not.toMatch(/^"use client";/m);

  for (const relative of [
    "site/src/app/workspace/purchases/loading.tsx",
    "site/src/app/auth/login/loading.tsx",
    "site/src/app/users/[username]/loading.tsx",
  ]) {
    const source = read(relative);
    expect(source).toContain("features/shell/honest-loading");
    expect(source).toContain("<HonestLoadingShell");
  }
});

it("renders the honest loading a11y chrome without inventing results", () => {
  const html = renderToStaticMarkup(
    createElement(
      HonestLoadingShell,
      {
        className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
        headingId: "purchases-loading-heading",
        title: "Purchases",
        loadingLabel: "Loading…",
      },
      createElement("div", { className: "animate-pulse", "aria-hidden": "true" }, "skeleton"),
    ),
  );
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('aria-labelledby="purchases-loading-heading"');
  expect(html).toContain('id="purchases-loading-heading"');
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("Purchases");
  expect(html).toContain("Loading…");
  expect(html).toContain('aria-hidden="true"');
});
