import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));

import ServerTrustLoading from "../../src/app/servers/[slug]/trust/loading";
import { getLicenseControlCopy } from "../../src/lib/license-control-i18n";
import { contextTrustCopy } from "../../src/lib/public-context-trust-copy";
import { serverContentCopy } from "../../src/lib/server-content-copy";
import { serverObservationBrowserCopy } from "../../src/lib/server-observation-browser-copy";
import { serverPublicationHistoryCopy } from "../../src/lib/server-publication-history-copy";
import { serverStatisticsCopy } from "../../src/lib/server-statistics-copy";
import { serverWorkspaceCopy } from "../../src/lib/server-workspace-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedPages = [
  "site/src/app/workspace/servers/[id]/activity/page.tsx",
  "site/src/app/workspace/servers/[id]/statistics/page.tsx",
  "site/src/app/workspace/servers/[id]/observations/page.tsx",
  "site/src/app/workspace/servers/[id]/content/new/page.tsx",
  "site/src/app/workspace/servers/[id]/content/[contentId]/page.tsx",
  "site/src/app/workspace/servers/[id]/content/[contentId]/history/page.tsx",
  "site/src/app/servers/[slug]/trust/page.tsx",
  "site/src/app/workspace/licenses/[id]/history/page.tsx",
] as const;

const clippedLoadings = [
  "site/src/app/workspace/servers/[id]/statistics/loading.tsx",
  "site/src/app/workspace/servers/[id]/observations/loading.tsx",
  "site/src/app/servers/[slug]/trust/loading.tsx",
] as const;

it("locks residual workspace server page shells to clipped min-w-0 frames", () => {
  for (const page of clippedPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
  }
});

it("locks residual workspace server loading shells to clipped frames", () => {
  for (const loading of clippedLoadings) {
    const source = read(loading);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
  }
});

it("keeps the server trust loading shell clipped without inventing results", async () => {
  const copy = contextTrustCopy("en");
  const html = renderToStaticMarkup(await ServerTrustLoading());
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('id="context-trust-loading-heading"');
  expect(html).toContain(copy.title);
  expect(html).toContain(copy.loading);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-w-0");
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
    expect(html).toContain("overflow-x-clip");
  },
);

it("locks managed statistics and observations loading shells to honest busy copy", () => {
  const statistics = read("site/src/components/server-statistics-page.tsx");
  const observations = read("site/src/components/server-observation-browser-page.tsx");
  expect(statistics).toContain("ServerStatisticsLoading");
  expect(statistics).toContain("copy.loading");
  expect(statistics).toContain("aria-busy");
  expect(statistics).toContain("overflow-x-clip");
  expect(observations).toContain("ServerObservationBrowserLoading");
  expect(observations).toContain("copy.loading");
  expect(observations).toContain("aria-busy");
  expect(observations).toContain("overflow-x-clip");
  expect(read("site/src/app/workspace/servers/[id]/statistics/loading.tsx")).toContain(
    "overflow-x-clip",
  );
  expect(read("site/src/app/workspace/servers/[id]/observations/loading.tsx")).toContain(
    "overflow-x-clip",
  );
});

it("locks residual delegated surfaces to ErrorState/EmptyState honesty chrome", () => {
  const surfaces = [
    "site/src/components/server-workspace-history-screen.tsx",
    "site/src/components/server-statistics-page.tsx",
    "site/src/components/server-observation-browser-page.tsx",
    "site/src/components/server-content-editor-page.tsx",
    "site/src/components/context-publication-history-screen.tsx",
    "site/src/components/public-context-trust-page.tsx",
    "site/src/components/license-history-page.tsx",
  ];
  for (const surface of surfaces) {
    const source = read(surface);
    expect(source).toContain("ErrorState");
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("min-h-11");
  }
  expect(read("site/src/components/server-workspace-history-screen.tsx")).toContain("EmptyState");
  expect(read("site/src/components/server-observation-browser-page.tsx")).toContain("EmptyState");
  expect(read("site/src/components/context-publication-history-screen.tsx")).toContain(
    "EmptyState",
  );
  expect(read("site/src/components/public-context-trust-page.tsx")).toContain("EmptyState");
});

it("locks residual honesty copy for server and license residual shells", () => {
  expect(serverWorkspaceCopy("en").historyUnavailableHint.length).toBeGreaterThan(0);
  expect(serverWorkspaceCopy("ru").historyUnavailableHint.length).toBeGreaterThan(0);
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
  expect(read("site/src/lib/server-workspace-copy.ts")).toContain("historyUnavailableHint");
  expect(read("site/src/lib/server-statistics-copy.ts")).toContain("unavailableHint");
  expect(read("site/src/lib/server-observation-browser-copy.ts")).toContain("unavailableHint");
  expect(read("site/src/lib/server-publication-history-copy.ts")).toContain("unavailableHint");
  expect(read("site/src/lib/server-content-copy.ts")).toContain("loadUnavailableHint");
  expect(read("site/src/lib/public-context-trust-copy.ts")).toContain("unavailableHint");
  expect(read("site/src/lib/license-control-i18n.ts")).toContain("loadUnavailableHint");
  expect(read("site/src/lib/license-control-i18n.ts")).toContain("noHistoryHint");
});
