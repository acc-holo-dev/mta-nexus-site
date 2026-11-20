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
    "site/src/app/admin/loading.tsx",
    "site/src/app/workspace/content/loading.tsx",
    "site/src/app/workspace/platform-reports/loading.tsx",
    "site/src/app/workspace/purchases/loading.tsx",
    "site/src/app/auth/login/loading.tsx",
    "site/src/app/users/[username]/loading.tsx",
    "site/src/app/workspace/platform-reports/[id]/loading.tsx",
    "site/src/app/discover/loading.tsx",
    "site/src/app/notifications/loading.tsx",
    "site/src/app/workspace/finance/loading.tsx",
    "site/src/app/workspace/servers/new/loading.tsx",
  ]) {
    const source = read(relative);
    expect(source).toContain("features/shell/route-honest-loading-server");
    expect(source).toMatch(
      /(?:DictionaryRouteLoading|LocaleCopyRouteLoading|RouteHonestLoading)\s*[<(]|<(?:Dictionary|Route)HonestLoading/,
    );
  }

  {
    const port = read("site/src/features/shell/route-honest-loading-server.ts");
    expect(port).toContain("DictionaryRouteLoading");
    expect(port).toContain("LocaleCopyRouteLoading");
    expect(port).toContain("RouteHonestLoading");
    expect(read("site/src/features/shell/server/route-honest-loading.tsx")).toContain(
      "<HonestLoadingShell",
    );
  }

  {
    const source = read("site/src/features/shell/components/global-loading-page.tsx");
    expect(source).toContain('from "../honest-loading"');
    expect(source).toContain("<HonestLoadingShell");
    expect(read("site/src/app/loading.tsx")).toContain("features/shell/global-loading-page");
  }

  for (const relative of [
    "site/src/features/accounts/components/settings-page-client.tsx",
    "site/src/features/support/components/support-case-thread.tsx",
    "site/src/features/commerce/components/acquire-page.tsx",
  ]) {
    const source = read(relative);
    expect(source).toContain('from "../../shell/honest-loading"');
    expect(source).toContain("<HonestLoadingShell");
  }

  for (const relative of [
    "site/src/features/servers/server/server-statistics-page.tsx",
    "site/src/features/servers/server/server-observation-browser-page.tsx",
    "site/src/features/community/server/publication-feed-loading.tsx",
  ]) {
    const source = read(relative);
    expect(source).toContain("route-honest-loading-server");
    expect(source).toMatch(/(?:LocaleCopyRouteLoading|RouteHonestLoading)\s*[<(]/);
  }

  const shellSource = read("site/src/features/shell/components/honest-loading-shell.tsx");
  expect(shellSource).toContain("description");
  expect(shellSource).toContain("headingLevel");
  expect(read("site/src/features/accounts/components/context-switcher.tsx")).toContain(
    "<HonestLoadingShell",
  );
  expect(read("site/src/features/accounts/components/context-switcher.tsx")).toContain(
    "headingLevel={2}",
  );
});

it("renders the honest loading a11y chrome without inventing results", () => {
  const html = renderToStaticMarkup(
    createElement(
      HonestLoadingShell,
      {
        className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
        headingId: "purchases-loading-heading",
        title: "Purchases",
        description: createElement("p", { className: "text-sm text-secondary" }, "Neutral desk"),
        loadingLabel: "Loading…",
      },
      createElement("div", { className: "animate-pulse", "aria-hidden": "true" }, "skeleton"),
    ),
  );
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('aria-labelledby="purchases-loading-heading"');
  expect(html).toContain('id="purchases-loading-heading"');
  expect(html).toContain("<h1");
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("Purchases");
  expect(html).toContain("Neutral desk");
  expect(html).toContain("Loading…");
  expect(html).toContain('aria-hidden="true"');
});

it("supports nested panel headings without promoting them to h1", () => {
  const html = renderToStaticMarkup(
    createElement(HonestLoadingShell, {
      headingId: "context-loading-heading",
      headingLevel: 2,
      title: "Workspace context",
      loadingLabel: "Loading…",
      titleClassName: "text-sm font-semibold text-primary",
      statusClassName: "text-xs text-muted",
    }),
  );
  expect(html).toContain("<h2");
  expect(html).not.toContain("<h1");
  expect(html).toContain('aria-busy="true"');
});
