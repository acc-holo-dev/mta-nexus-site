vi.mock("server-only", () => ({}));

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

function expectClippedLoadingSource(source: string) {
  if (/[A-Za-z]\w*RouteLoading|pageShell|page-shell/.test(source)) {
    expect(source).toMatch(/[A-Za-z]\w*RouteLoading|pageShell|page-shell/);
    return;
  }
  expect(source).toMatch(/(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
  expect(source).toMatch(/(?:min-w-0|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
}

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));

import ServerTrustLoading from "../../src/app/servers/[slug]/trust/loading";
import { getLicenseControlCopy } from "../../src/features/commerce/license-control-i18n";
import { serverContentCopy } from "../../src/features/servers/server-content-copy";
import { serverObservationBrowserCopy } from "../../src/features/servers/server-observation-browser-copy";
import { serverPublicationHistoryCopy } from "../../src/features/servers/server-publication-history-copy";
import { serverStatisticsCopy } from "../../src/features/servers/server-statistics-copy";
import { serverWorkspaceCopy } from "../../src/features/servers/server-workspace-copy";
import { contextTrustCopy } from "../../src/features/trust/public-context-trust-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedPages = [
  "site/src/features/servers/server/server-workspace-history-screen.tsx",
  "site/src/features/servers/server/server-statistics-page.tsx",
  "site/src/features/servers/server/server-observation-browser-page.tsx",
  "site/src/features/servers/server/server-content-editor-page.tsx",
  "site/src/features/servers/server/server-content-editor-page.tsx",
  "site/src/features/community/server/context-publication-history-screen.tsx",
  "site/src/features/trust/server/public-context-trust-page.tsx",
  "site/src/features/commerce/server/license-history-page.tsx",
] as const;

const delegatedLoadings = [
  [
    "site/src/app/workspace/servers/[id]/statistics/loading.tsx",
    "features/servers/statistics-server",
  ],
  [
    "site/src/app/workspace/servers/[id]/observations/loading.tsx",
    "features/servers/observations-server",
  ],
  ["site/src/app/servers/[slug]/trust/loading.tsx", "organizations/[slug]/trust/loading"],
] as const;

it("locks residual workspace server page shells to clipped min-w-0 frames", () => {
  for (const page of clippedPages) {
    const source = read(page);
    expectClippedLoadingSource(source);
  }
});

it("locks residual workspace server loadings to feature/delegate ports with clipped chrome", () => {
  for (const [loading, port] of delegatedLoadings) {
    const source = read(loading);
    expect(source).toContain(port);
  }
  expect(read("site/src/features/servers/server/server-statistics-page.tsx")).toMatch(
    /(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/,
  );
  expect(read("site/src/features/servers/server/server-observation-browser-page.tsx")).toMatch(
    /(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/,
  );
  expect(read("site/src/features/servers/server/server-statistics-page.tsx")).toMatch(
    /(?:min-w-0|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/,
  );
  expect(read("site/src/features/servers/server/server-observation-browser-page.tsx")).toMatch(
    /(?:min-w-0|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/,
  );
});

it("keeps the server trust loading shell clipped without inventing results", async () => {
  const copy = contextTrustCopy("en");
  const html = renderToStaticMarkup(await ServerTrustLoading());
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('id="context-trust-loading-heading"');
  expect(html).toContain(copy.title);
  expect(html).toContain(copy.loading);
  expectClippedLoadingSource(html);
  expect(html).toContain('role="status"');
});

it.each(["en", "ru"] as const)(
  "keeps the %s server trust loading copy honest while clipped",
  async (locale) => {
    state.locale = locale;
    const copy = contextTrustCopy(locale);
    const html = renderToStaticMarkup(await ServerTrustLoading());
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.loading);
    expectClippedLoadingSource(html);
  },
);

it("locks managed statistics and observations loading shells to honest busy copy", () => {
  const statistics = read("site/src/features/servers/server/server-statistics-page.tsx");
  const observations = read("site/src/features/servers/server/server-observation-browser-page.tsx");
  expect(statistics).toContain("ServerStatisticsLoading");
  expect(statistics).toContain("copy.loading");
  expect(statistics).toMatch(/LocaleCopyRouteLoading|RouteHonestLoading/);
  expectClippedLoadingSource(statistics);
  expect(observations).toContain("ServerObservationBrowserLoading");
  expect(observations).toContain("copy.loading");
  expect(observations).toMatch(/LocaleCopyRouteLoading|RouteHonestLoading/);
  expectClippedLoadingSource(observations);
  expect(read("site/src/app/workspace/servers/[id]/statistics/loading.tsx")).toContain(
    "features/servers/statistics-server",
  );
  expect(read("site/src/app/workspace/servers/[id]/observations/loading.tsx")).toContain(
    "features/servers/observations-server",
  );
});

it("locks residual delegated surfaces to ErrorState/EmptyState honesty chrome", () => {
  const surfaces = [
    "site/src/features/servers/server/server-workspace-history-screen.tsx",
    "site/src/features/servers/server/server-statistics-page.tsx",
    "site/src/features/servers/server/server-observation-browser-page.tsx",
    "site/src/features/servers/server/server-content-editor-page.tsx",
    "site/src/features/community/server/context-publication-history-screen.tsx",
    "site/src/features/trust/server/public-context-trust-page.tsx",
    "site/src/features/commerce/server/license-history-page.tsx",
  ];
  for (const surface of surfaces) {
    const source = read(surface);
    expect(source).toContain("ErrorState");
    expectClippedLoadingSource(source);
    expect(source).toContain("min-h-11");
  }
  expect(read("site/src/features/servers/server/server-workspace-history-screen.tsx")).toContain(
    "EmptyState",
  );
  expect(read("site/src/features/servers/server/server-observation-browser-page.tsx")).toContain(
    "EmptyState",
  );
  expect(
    read("site/src/features/community/server/context-publication-history-screen.tsx"),
  ).toContain("EmptyState");
  expect(read("site/src/features/trust/server/public-context-trust-page.tsx")).toContain(
    "EmptyState",
  );
});

it("locks residual honesty copy for server and license residual shells", () => {
  expect(serverWorkspaceCopy("en").historyUnavailableHint.length).toBeGreaterThan(0);
  expect(serverWorkspaceCopy("ru").historyUnavailableHint.length).toBeGreaterThan(0);
  expect(serverWorkspaceCopy("en").unavailableHint.length).toBeGreaterThan(0);
  expect(serverWorkspaceCopy("ru").unavailableHint.length).toBeGreaterThan(0);
  expect(serverStatisticsCopy("en").unavailableHint.length).toBeGreaterThan(0);
  expect(serverStatisticsCopy("ru").unavailableHint.length).toBeGreaterThan(0);
  expect(serverObservationBrowserCopy("en").unavailableHint.length).toBeGreaterThan(0);
  expect(serverObservationBrowserCopy("ru").unavailableHint.length).toBeGreaterThan(0);
  expect(serverPublicationHistoryCopy("en").unavailableHint.length).toBeGreaterThan(0);
  expect(serverPublicationHistoryCopy("ru").unavailableHint.length).toBeGreaterThan(0);
  expect(serverContentCopy("en").loadUnavailableHint.length).toBeGreaterThan(0);
  expect(serverContentCopy("ru").loadUnavailableHint.length).toBeGreaterThan(0);
  expect(contextTrustCopy("en").unavailableHint.length).toBeGreaterThan(0);
  expect(contextTrustCopy("ru").unavailableHint.length).toBeGreaterThan(0);
  expect(getLicenseControlCopy("en").loadUnavailableHint.length).toBeGreaterThan(0);
  expect(getLicenseControlCopy("ru").loadUnavailableHint.length).toBeGreaterThan(0);
  expect(getLicenseControlCopy("en").noHistoryHint.length).toBeGreaterThan(0);
  expect(getLicenseControlCopy("ru").noHistoryHint.length).toBeGreaterThan(0);
  expect(read("site/src/features/servers/server-workspace-copy.ts")).toContain(
    "historyUnavailableHint",
  );
  expect(read("site/src/features/servers/server-workspace-copy.ts")).toContain("unavailableHint");
  expect(read("site/src/features/servers/server-review-i18n.ts")).toContain("loadUnavailableHint");
  expect(read("site/src/features/servers/server-statistics-copy.ts")).toContain("unavailableHint");
  expect(read("site/src/features/servers/server-statistics-copy.ts")).toContain("pausedHint:");
  expect(read("site/src/features/servers/server/server-statistics-panel.tsx")).toContain(
    'id="server-statistics-collection-paused"',
  );
  expect(read("site/src/features/servers/server/server-statistics-panel.tsx")).toContain(
    "description={copy.pausedHint}",
  );
  expect(read("site/src/features/servers/server/server-statistics-panel.tsx")).not.toContain(
    '<p className="text-sm text-muted">{copy.paused}</p>',
  );
  expect(read("site/src/features/servers/server/server-observation-browser-page.tsx")).toContain(
    'id="server-observation-collection-paused"',
  );
  expect(
    read("site/src/features/servers/server/server-observation-browser-page.tsx"),
  ).not.toContain('<p className="text-sm text-muted">{stats.paused}</p>');
  expect(read("site/src/features/servers/server-observation-browser-copy.ts")).toContain(
    "unavailableHint",
  );
  expect(read("site/src/features/servers/server-publication-history-copy.ts")).toContain(
    "unavailableHint",
  );
  expect(read("site/src/features/servers/server-content-copy.ts")).toContain("loadUnavailableHint");
  expect(read("site/src/features/trust/public-context-trust-copy.ts")).toContain("unavailableHint");
  expect(read("site/src/features/commerce/license-control-i18n.ts")).toContain(
    "loadUnavailableHint",
  );
  expect(read("site/src/features/commerce/license-control-i18n.ts")).toContain("noHistoryHint");
});
