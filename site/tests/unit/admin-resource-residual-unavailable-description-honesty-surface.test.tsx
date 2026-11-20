import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const pages: Array<[string, string]> = [
  ["site/src/features/moderation/server/admin-home-screen.tsx", "copy.hubUnavailableHint"],
  ["site/src/features/resources/server/staff-resources-screen.tsx", "copy.loadUnavailableHint"],
  [
    "site/src/features/resources/server/staff-resource-detail-screen.tsx",
    "copy.loadUnavailableHint",
  ],
  ["site/src/features/moderation/server/staff-storage-screen.tsx", "copy.loadUnavailableHint"],
  [
    "site/src/features/moderation/server/staff-storage-object-screen.tsx",
    "copy.loadUnavailableHint",
  ],
  ["site/src/app/admin/commerce/plans/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/admin/commerce/plans/[id]/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/admin/commerce/reconciliation/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/admin/commerce/reconciliation/[id]/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/admin/commerce/reconciliation/[id]/terms/page.tsx", "c.loadUnavailableHint"],
  ["site/src/app/workspace/resources/[id]/activity/page.tsx", "copy.loadUnavailableHint"],
  [
    "site/src/features/resources/server/resource-publisher-history-screen.tsx",
    "copy.loadUnavailableHint",
  ],
  ["site/src/app/workspace/resources/[id]/moderation/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/features/resources/server/resource-copies-screen.tsx", "c.loadUnavailableHint"],
  ["site/src/app/workspace/resources/[id]/copy/page.tsx", "c.loadUnavailableHint"],
  ["site/src/app/workspace/resources/[id]/copies/[receiptId]/page.tsx", "c.loadUnavailableHint"],
  ["site/src/app/workspace/purchases/[id]/operations/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/workspace/purchases/[id]/terms/page.tsx", "c.loadUnavailableHint"],
];

it("locks residual admin/resource loadUnavailable ErrorStates to recovery hints", () => {
  for (const [path, hint] of pages) {
    expect(read(path), path).toContain(`description={${hint}}`);
  }
  expect(read("site/src/lib/i18n/en/admin.ts")).toContain("hubUnavailableHint:");
  expect(read("site/src/lib/i18n/ru/admin.ts")).toContain("hubUnavailableHint:");
  expect(read("site/src/features/library/resource-release-control-i18n.ts")).toContain(
    "loadUnavailableHint:",
  );
  expect(read("site/src/features/moderation/storage-maintenance-i18n.ts")).toContain(
    "loadUnavailableHint:",
  );
  expect(read("site/src/features/commerce/commercial-i18n.ts")).toContain("loadUnavailableHint:");
  expect(read("site/src/features/commerce/financial-i18n.ts")).toContain("loadUnavailableHint:");
  expect(read("site/src/features/commerce/order-terms-i18n.ts")).toContain("loadUnavailableHint:");
  expect(read("site/src/features/resources/resource-activity-i18n.ts")).toContain(
    "loadUnavailableHint:",
  );
  expect(read("site/src/features/resources/resource-copy-i18n.ts")).toContain(
    "loadUnavailableHint:",
  );
});
