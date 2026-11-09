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
vi.mock("../../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));

import ActivityLoading from "../../apps/web/src/app/workspace/organizations/[id]/activity/loading";
import ContentHistoryLoading from "../../apps/web/src/app/workspace/organizations/[id]/content/[contentId]/history/loading";
import ContentDetailLoading from "../../apps/web/src/app/workspace/organizations/[id]/content/[contentId]/loading";
import ContentLoading from "../../apps/web/src/app/workspace/organizations/[id]/content/loading";
import ContentNewLoading from "../../apps/web/src/app/workspace/organizations/[id]/content/new/loading";
import { organizationGovernanceCopy } from "../../apps/web/src/lib/organization-governance-copy";
import { organizationPublicationHistoryCopy } from "../../apps/web/src/lib/organization-publication-history-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedOrgPages = [
  "apps/web/src/app/workspace/organizations/[id]/activity/page.tsx",
  "apps/web/src/app/workspace/organizations/[id]/content/new/page.tsx",
  "apps/web/src/app/workspace/organizations/[id]/content/[contentId]/page.tsx",
  "apps/web/src/app/workspace/organizations/[id]/content/[contentId]/history/page.tsx",
] as const;

const clippedSubscriptionPages = [
  "apps/web/src/app/workspace/subscriptions/page.tsx",
  "apps/web/src/app/workspace/subscriptions/activate/page.tsx",
  "apps/web/src/app/workspace/subscriptions/history/page.tsx",
  "apps/web/src/app/workspace/subscriptions/reviews/page.tsx",
  "apps/web/src/app/workspace/subscriptions/reviews/new/page.tsx",
  "apps/web/src/app/workspace/subscriptions/reviews/[id]/page.tsx",
  "apps/web/src/app/workspace/subscriptions/receipts/[id]/page.tsx",
] as const;

it("locks workspace org activity and content page shells to clipped min-w-0 frames", () => {
  for (const page of clippedOrgPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
  }
});

it("exposes a search landmark on the workspace organizations directory filter", () => {
  expect(read("apps/web/src/app/workspace/organizations/page.tsx")).toContain(
    "<search aria-label={copy.search}>",
  );
});

it("locks residual workspace subscription page shells to clipped min-w-0 frames", () => {
  for (const page of clippedSubscriptionPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
    expect(source).toContain("ErrorState");
  }
  expect(read("apps/web/src/app/workspace/subscriptions/page.tsx")).toContain("EmptyState");
  expect(read("apps/web/src/app/workspace/subscriptions/history/page.tsx")).toContain("EmptyState");
  expect(read("apps/web/src/app/workspace/subscriptions/reviews/page.tsx")).toContain("EmptyState");
  expect(read("apps/web/src/app/workspace/subscriptions/reviews/new/page.tsx")).toContain(
    "EmptyState",
  );
});

it.each([
  ["activity", ActivityLoading, "organization-activity-loading-heading"],
  ["content", ContentLoading, "org-content-loading-heading"],
  ["content new", ContentNewLoading, "org-content-new-loading-heading"],
  ["content detail", ContentDetailLoading, "org-content-detail-loading-heading"],
  ["content history", ContentHistoryLoading, "content-history-loading-heading"],
] as const)(
  "keeps the organization %s loading shell clipped without inventing results",
  async (_name, Loading, headingId) => {
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain('role="status"');
    expect(html).toContain(`id="${headingId}"`);
  },
);

it.each(["en", "ru"] as const)(
  "keeps the %s organization activity loading copy honest while clipped",
  async (locale) => {
    state.locale = locale;
    const copy = organizationGovernanceCopy(locale);
    const html = renderToStaticMarkup(await ActivityLoading());
    expect(html).toContain(copy.history);
    expect(html).toContain(copy.historyDescription);
    expect(html).toContain("overflow-x-clip");
  },
);

it("locks organization content honesty chrome through shared surfaces and additive i18n", () => {
  expect(read("apps/web/src/components/organization-history.tsx")).toContain("ErrorState");
  expect(read("apps/web/src/components/organization-history.tsx")).toContain("EmptyState");
  expect(read("apps/web/src/components/organization-content-editor-page.tsx")).toContain(
    "ErrorState",
  );
  expect(read("apps/web/src/components/context-publication-history-screen.tsx")).toContain(
    "ErrorState",
  );
  expect(read("apps/web/src/components/context-publication-history-screen.tsx")).toContain(
    "EmptyState",
  );
  expect(read("apps/web/src/components/context-publication-history-screen.tsx")).toContain(
    "historyEmptyHint",
  );
  expect(read("apps/web/src/lib/organization-publication-history-copy.ts")).toContain(
    "historyEmptyHint",
  );
  expect(read("apps/web/src/lib/organization-publication-history-copy.ts")).toContain("loading:");
  expect(organizationPublicationHistoryCopy("en").historyEmptyHint.length).toBeGreaterThan(0);
  expect(organizationPublicationHistoryCopy("ru").historyEmptyHint.length).toBeGreaterThan(0);
  expect(organizationPublicationHistoryCopy("en").loading.length).toBeGreaterThan(0);
  expect(organizationGovernanceCopy("en").emptyHint.length).toBeGreaterThan(0);
});
