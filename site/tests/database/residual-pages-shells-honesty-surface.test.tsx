import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

function expectClippedLoadingSource(source: string) {
  if (/[A-Za-z]\w*RouteLoading/.test(source)) {
    expect(source).toMatch(/[A-Za-z]\w*RouteLoading/);
    return;
  }
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");
}

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));

import AdminReportHistoryLoading from "../../src/app/admin/reports/[id]/history/loading";
import AdminSupportMessagesLoading from "../../src/app/admin/support/[id]/messages/loading";
import { reportHistoryCopy } from "../../src/features/community/community-report-history-copy";
import { supportMessageCopy } from "../../src/features/support/support-message-discovery-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedShellPages = [
  "site/src/features/community/server/community-report-screen.tsx",
  "site/src/features/community/server/community-report-history-page.tsx",
  "site/src/features/library/server/library-release-history-screen.tsx",
  "site/src/features/shell/server/development-status-screen.tsx",
] as const;

it("locks residual page shells to clipped min-w-0 frames", () => {
  for (const page of clippedShellPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
  }
});

it("keeps residual report and version-history routes as thin clipped shells around honest screens", () => {
  expect(read("site/src/features/community/server/community-report-screen.tsx")).toContain(
    "CommunityReportScreen",
  );
  expect(read("site/src/features/community/server/community-report-history-page.tsx")).toContain(
    "CommunityReportHistoryPage",
  );
  expect(read("site/src/features/library/server/library-release-history-screen.tsx")).toContain(
    "LibraryReleaseHistoryScreen",
  );
  expect(read("site/src/features/community/server/community-report-screen.tsx")).toContain(
    "ErrorState",
  );
  expect(read("site/src/features/community/server/community-report-history-page.tsx")).toContain(
    "ErrorState",
  );
  expect(read("site/src/features/library/server/library-release-history-screen.tsx")).toContain(
    "ErrorState",
  );
});

it("keeps admin support messages and report history loadings as clipped re-exports", () => {
  expect(read("site/src/app/admin/support/[id]/messages/loading.tsx")).toContain(
    'from "../../../../support/[id]/messages/loading"',
  );
  expect(read("site/src/app/admin/reports/[id]/history/loading.tsx")).toContain(
    'from "../../../../workspace/reports/[id]/history/loading"',
  );
  expectClippedLoadingSource(read("site/src/app/support/[id]/messages/loading.tsx"));
  expectClippedLoadingSource(read("site/src/app/workspace/reports/[id]/history/loading.tsx"));
});

it.each([
  [
    "admin support messages",
    AdminSupportMessagesLoading,
    () => supportMessageCopy("en"),
    "title",
    "loading",
  ],
  [
    "admin report history",
    AdminReportHistoryLoading,
    () => reportHistoryCopy("en"),
    "title",
    "loading",
  ],
] as const)(
  "keeps the %s loading re-export clipped without inventing results",
  async (_name, Loading, copyOf, titleKey, loadingKey) => {
    const copy = copyOf();
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain(copy[titleKey]);
    expect(html).toContain(copy[loadingKey]);
    expect(html).toContain('role="status"');
  },
);

it("locks /dev diagnostics shell clipped without raw alert failure chrome", () => {
  const source = read("site/src/features/shell/server/development-status-screen.tsx");
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");

  expect(source).toContain("checkDatabaseConnection");
  expect(source).not.toContain('role="alert"');
  expect(source).not.toContain("ErrorState");
});
