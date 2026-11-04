import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));

import OrganizationActivityLoading from "../apps/web/src/app/organizations/[slug]/activity/loading";
import ServerUpdatesLoading from "../apps/web/src/app/servers/[slug]/updates/loading";
import UserActivityLoading from "../apps/web/src/app/users/[username]/activity/loading";
import { publicationCopy } from "../apps/web/src/lib/publication-feed-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedPages = [
  "apps/web/src/app/support/page.tsx",
  "apps/web/src/app/support/[id]/page.tsx",
  "apps/web/src/app/support/[id]/messages/page.tsx",
  "apps/web/src/app/organizations/[slug]/activity/page.tsx",
  "apps/web/src/app/organizations/[slug]/trust/page.tsx",
  "apps/web/src/app/users/[username]/activity/page.tsx",
  "apps/web/src/app/servers/[slug]/updates/page.tsx",
  "apps/web/src/app/servers/[slug]/statistics/page.tsx",
  "apps/web/src/app/servers/[slug]/observations/page.tsx",
] as const;

const clippedLoadings = [
  "apps/web/src/app/organizations/[slug]/activity/loading.tsx",
  "apps/web/src/app/users/[username]/activity/loading.tsx",
  "apps/web/src/app/servers/[slug]/updates/loading.tsx",
  "apps/web/src/app/servers/[slug]/statistics/loading.tsx",
  "apps/web/src/app/servers/[slug]/observations/loading.tsx",
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
  const source = read("apps/web/src/app/checkout/page.tsx");
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
  const statistics = read("apps/web/src/components/server-statistics-page.tsx");
  const observations = read("apps/web/src/components/server-observation-browser-page.tsx");
  expect(statistics).toContain("ServerStatisticsLoading");
  expect(statistics).toContain("copy.loading");
  expect(statistics).toContain("aria-busy");
  expect(statistics).toContain("overflow-x-clip");
  expect(observations).toContain("ServerObservationBrowserLoading");
  expect(observations).toContain("copy.loading");
  expect(observations).toContain("aria-busy");
  expect(observations).toContain("overflow-x-clip");
  expect(read("apps/web/src/app/servers/[slug]/statistics/loading.tsx")).toContain(
    "overflow-x-clip",
  );
  expect(read("apps/web/src/app/servers/[slug]/observations/loading.tsx")).toContain(
    "overflow-x-clip",
  );
});

it("locks nested support and activity surfaces to ErrorState/EmptyState honesty chrome", () => {
  const surfaces = [
    "apps/web/src/components/support-page.tsx",
    "apps/web/src/components/support-message-page.tsx",
    "apps/web/src/components/support-center.tsx",
    "apps/web/src/components/public-profile-activity.tsx",
    "apps/web/src/components/public-context-trust-page.tsx",
    "apps/web/src/components/server-statistics-page.tsx",
    "apps/web/src/components/server-observation-browser-page.tsx",
    "apps/web/src/components/publication-feed.tsx",
  ];
  for (const surface of surfaces) {
    const source = read(surface);
    expect(source).toContain("ErrorState");
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("min-h-11");
  }
  expect(read("apps/web/src/components/support-center.tsx")).toContain("EmptyState");
  expect(read("apps/web/src/components/public-context-trust-page.tsx")).toContain("EmptyState");
  expect(read("apps/web/src/components/server-observation-browser-page.tsx")).toContain(
    "EmptyState",
  );
  expect(read("apps/web/src/components/publication-feed.tsx")).toContain("EmptyState");
});

it("locks support case/filter/message controls to touch targets without min-h-10", () => {
  const touchSurfaces = [
    "apps/web/src/components/support-case-actions.tsx",
    "apps/web/src/components/support-center.tsx",
    "apps/web/src/components/support-message-browser.tsx",
  ] as const;
  for (const path of touchSurfaces) {
    const source = read(path);
    expect(source, path).toMatch(/min-h-11|size="touch"/u);
    expect(source, path).not.toContain("min-h-10");
  }
  expect(read("apps/web/src/components/support-case-actions.tsx")).toContain('size="touch"');
  expect(read("apps/web/src/components/support-center.tsx")).toContain('size="touch"');
  expect(read("apps/web/src/components/support-center.tsx")).toContain(
    "inline-flex min-h-11 items-center",
  );
  expect(read("apps/web/src/components/support-message-browser.tsx")).toContain('size="touch"');
});
