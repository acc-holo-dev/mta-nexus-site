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

import AdminReportHistoryLoading from "../../apps/web/src/app/admin/reports/[id]/history/loading";
import AdminSupportMessagesLoading from "../../apps/web/src/app/admin/support/[id]/messages/loading";
import { reportHistoryCopy } from "../../apps/web/src/lib/community-report-history-copy";
import { supportMessageCopy } from "../../apps/web/src/lib/support-message-discovery-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedShellPages = [
  "apps/web/src/app/workspace/reports/[id]/page.tsx",
  "apps/web/src/app/workspace/reports/[id]/history/page.tsx",
  "apps/web/src/app/workspace/library/version-history/page.tsx",
  "apps/web/src/app/dev/page.tsx",
] as const;

it("locks residual page shells to clipped min-w-0 frames", () => {
  for (const page of clippedShellPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
  }
});

it("keeps residual report and version-history routes as thin clipped shells around honest screens", () => {
  expect(read("apps/web/src/app/workspace/reports/[id]/page.tsx")).toContain(
    "CommunityReportScreen",
  );
  expect(read("apps/web/src/app/workspace/reports/[id]/history/page.tsx")).toContain(
    "CommunityReportHistoryPage",
  );
  expect(read("apps/web/src/app/workspace/library/version-history/page.tsx")).toContain(
    "LibraryReleaseHistoryScreen",
  );
  expect(read("apps/web/src/components/community-report-screen.tsx")).toContain("ErrorState");
  expect(read("apps/web/src/components/community-report-history-page.tsx")).toContain("ErrorState");
  expect(read("apps/web/src/components/library-release-history-screen.tsx")).toContain(
    "ErrorState",
  );
});

it("keeps admin support messages and report history loadings as clipped re-exports", () => {
  expect(read("apps/web/src/app/admin/support/[id]/messages/loading.tsx")).toContain(
    'from "../../../../support/[id]/messages/loading"',
  );
  expect(read("apps/web/src/app/admin/reports/[id]/history/loading.tsx")).toContain(
    'from "../../../../workspace/reports/[id]/history/loading"',
  );
  expect(read("apps/web/src/app/support/[id]/messages/loading.tsx")).toContain("overflow-x-clip");
  expect(read("apps/web/src/app/workspace/reports/[id]/history/loading.tsx")).toContain(
    "overflow-x-clip",
  );
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
  const source = read("apps/web/src/app/dev/page.tsx");
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");
  expect(source).toContain("pageShellClass");
  expect(source).toContain("checkDatabaseConnection");
  expect(source).not.toContain('role="alert"');
  expect(source).not.toContain("ErrorState");
});
