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

import OrganizationActivityLoading from "../../src/app/organizations/[slug]/activity/loading";
import ServerUpdatesLoading from "../../src/app/servers/[slug]/updates/loading";
import UserActivityLoading from "../../src/app/users/[username]/activity/loading";
import { publicationCopy } from "../../src/lib/publication-feed-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedPages = [
  "site/src/app/support/page.tsx",
  "site/src/app/support/[id]/page.tsx",
  "site/src/app/support/[id]/messages/page.tsx",
  "site/src/app/organizations/[slug]/activity/page.tsx",
  "site/src/app/organizations/[slug]/trust/page.tsx",
  "site/src/app/users/[username]/activity/page.tsx",
  "site/src/app/servers/[slug]/updates/page.tsx",
  "site/src/app/servers/[slug]/statistics/page.tsx",
  "site/src/app/servers/[slug]/observations/page.tsx",
] as const;

const clippedLoadings = [
  "site/src/app/organizations/[slug]/activity/loading.tsx",
  "site/src/app/users/[username]/activity/loading.tsx",
  "site/src/app/servers/[slug]/updates/loading.tsx",
  "site/src/app/servers/[slug]/statistics/loading.tsx",
  "site/src/app/servers/[slug]/observations/loading.tsx",
] as const;

it("locks support and activity page shells to clipped min-w-0 frames", () => {
  for (const page of clippedPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
  }
});

it("locks activity and server panel loading shells to clipped frames", () => {
  for (const loading of clippedLoadings) {
    const source = read(loading);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
  }
});

it("keeps legacy checkout as a compatibility redirect without payment chrome", () => {
  const source = read("site/src/app/checkout/page.tsx");
  expect(source).toContain("redirect");
  expect(source).toContain("/acquire");
  expect(source).not.toContain("ErrorState");
  expect(source).not.toContain("EmptyState");
  expect(source).not.toContain("/api/checkout");
  expect(source).not.toContain("paid");
  expect(source).not.toContain("payment");
});

it.each([
  ["organization activity", OrganizationActivityLoading, "activity"],
  ["user activity", UserActivityLoading, "activity"],
  ["server updates", ServerUpdatesLoading, "serverTitle"],
] as const)(
  "keeps the %s loading shell clipped without inventing results",
  async (_name, Loading, headingKey) => {
    state.locale = "en";
    const copy = publicationCopy("en");
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain('role="status"');
    expect(html).toContain(copy[headingKey]);
    expect(html).toContain(copy.loading);
  },
);

it("locks server statistics and observations loading shells to honest busy copy", () => {
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
  expect(read("site/src/app/servers/[slug]/statistics/loading.tsx")).toContain("overflow-x-clip");
  expect(read("site/src/app/servers/[slug]/observations/loading.tsx")).toContain("overflow-x-clip");
});

it("locks nested support and activity surfaces to ErrorState/EmptyState honesty chrome", () => {
  const surfaces = [
    "site/src/components/support-page.tsx",
    "site/src/components/support-message-page.tsx",
    "site/src/components/support-center.tsx",
    "site/src/components/public-profile-activity.tsx",
    "site/src/components/public-context-trust-page.tsx",
    "site/src/components/server-statistics-page.tsx",
    "site/src/components/server-observation-browser-page.tsx",
    "site/src/components/publication-feed.tsx",
  ];
  for (const surface of surfaces) {
    const source = read(surface);
    expect(source).toContain("ErrorState");
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("min-h-11");
  }
  expect(read("site/src/components/support-center.tsx")).toContain("EmptyState");
  expect(read("site/src/components/public-context-trust-page.tsx")).toContain("EmptyState");
  expect(read("site/src/components/server-observation-browser-page.tsx")).toContain("EmptyState");
  expect(read("site/src/components/publication-feed.tsx")).toContain("EmptyState");
});

it("locks support case/filter/message controls to touch targets without min-h-10", () => {
  const touchSurfaces = [
    "site/src/components/support-case-actions.tsx",
    "site/src/components/support-center.tsx",
    "site/src/components/support-message-browser.tsx",
    "site/src/components/support-case-thread.tsx",
  ] as const;
  for (const path of touchSurfaces) {
    const source = read(path);
    expect(source, path).toMatch(/min-h-11|size="touch"/u);
    expect(source, path).not.toContain("min-h-10");
    expect(source, path).not.toContain("min-h-9");
  }
  expect(read("site/src/components/support-case-actions.tsx")).toContain('size="touch"');
  expect(read("site/src/components/support-center.tsx")).toContain('size="touch"');
  expect(read("site/src/components/support-center.tsx")).toContain(
    "inline-flex min-h-11 items-center",
  );
  expect(read("site/src/components/support-message-browser.tsx")).toContain('size="touch"');
});

it("locks publication feed tags and copyable code CTAs to min-h-11", () => {
  const feed = read("site/src/components/publication-feed.tsx");
  expect(feed).toContain("inline-flex min-h-11 items-center break-all");
  expect(feed).not.toContain("min-h-8");
  expect(read("site/src/components/copyable-plain-code-block.tsx")).toContain(
    'className="min-h-11"',
  );
  expect(read("site/src/components/community-report-form.tsx")).not.toContain("min-h-9");
});

it("locks support-center create-case primary submit to size=touch", () => {
  const source = read("site/src/components/support-center.tsx");
  expect(source).toMatch(
    /type="submit"[\s\S]{0,120}?size="touch"[\s\S]{0,80}?variant="primary"|variant="primary"[\s\S]{0,80}?size="touch"/u,
  );
  const touchSubmitMatches =
    source.match(/type="submit"[^>]*size="touch"|size="touch"[^>]*type="submit"/gu) ?? [];
  expect(touchSubmitMatches.length).toBeGreaterThanOrEqual(2);
});
