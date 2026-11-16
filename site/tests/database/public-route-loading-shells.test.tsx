import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => "en" as const,
}));

import ContextTrustLoading from "../../src/app/organizations/[slug]/trust/loading";
import ReportGroupsLoading from "../../src/app/admin/reports/targets/loading";
import LibraryCollectionsLoading from "../../src/app/workspace/library/collections/loading";
import UserTrustHistoryLoading from "../../src/app/users/[username]/trust/history/loading";
import { contextTrustCopy } from "../../src/lib/public-context-trust-copy";
import { reportGroupsCopy } from "../../src/lib/community-report-groups-copy";
import { libraryCollectionsCopy } from "../../src/lib/library-collections-i18n";
import { approvalCopy } from "../../src/lib/public-verification-history-copy";

it.each([
  ["context trust", ContextTrustLoading, contextTrustCopy("en"), "context-trust-loading-heading"],
  ["report groups", ReportGroupsLoading, reportGroupsCopy("en"), "report-groups-loading-heading"],
  [
    "library collections",
    LibraryCollectionsLoading,
    libraryCollectionsCopy("en"),
    "library-collections-loading-heading",
  ],
  [
    "user trust history",
    UserTrustHistoryLoading,
    approvalCopy("en"),
    "user-trust-history-loading-heading",
  ],
] as const)("renders an honest loading shell for %s", async (_label, Loading, copy, headingId) => {
  const html = renderToStaticMarkup(await Loading());
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain(`id="${headingId}"`);
  expect(html).toContain(`aria-labelledby="${headingId}"`);
  expect(html).toContain(`>${copy.title}<`);
  expect(html).toContain(copy.loading);
  expect(html).toContain('role="status"');
});
