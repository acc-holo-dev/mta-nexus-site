import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const pages: Array<[string, string]> = [
  ["site/src/features/commerce/server/licenses-history-screen.tsx", "copy.loadUnavailableHint"],
  ["site/src/features/commerce/server/license-detail-page-screen.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/admin/licenses/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/admin/licenses/[id]/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/features/library/server/library-download-detail-page.tsx", "copy.loadUnavailableHint"],
  [
    "site/src/features/resources/server/publisher-deliveries-screen.tsx",
    "copy.loadUnavailableHint",
  ],
  ["site/src/features/resources/server/resource-variants-screen.tsx", "copy.loadUnavailableHint"],
  [
    "site/src/features/commerce/server/seller-sales-report-detail-screen.tsx",
    "c.loadUnavailableHint",
  ],
  ["site/src/features/accounts/server/developer-profile-screen.tsx", "copy.loadUnavailableHint"],
  ["site/src/features/accounts/server/user-profile-screen.tsx", "copy.loadUnavailableHint"],
  [
    "site/src/features/resources/server/resource-manage-screen.tsx",
    "publisherCopy.loadUnavailableHint",
  ],
];

it("locks workspace/admin loadUnavailable ErrorStates to recovery hints", () => {
  for (const [path, hint] of pages) {
    const source = read(path);
    expect(source, path).toContain("loadUnavailable");
    expect(source, path).toContain(`description={${hint}}`);
  }
  expect(read("site/src/features/commerce/commerce-history-i18n.ts")).toContain(
    "loadUnavailableHint:",
  );
  expect(read("site/src/lib/i18n/en/community.ts")).toContain("loadUnavailableHint:");
  expect(read("site/src/lib/i18n/ru/community.ts")).toContain("loadUnavailableHint:");
  expect(read("site/src/lib/i18n/en/publishing.ts")).toContain("loadUnavailableHint:");
  expect(read("site/src/lib/i18n/ru/publishing.ts")).toContain("loadUnavailableHint:");
  expect(read("site/src/features/resources/resource-publisher-i18n.ts")).toContain(
    "loadUnavailableHint:",
  );
});
