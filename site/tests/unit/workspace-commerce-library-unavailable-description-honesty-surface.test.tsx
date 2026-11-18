import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const pages: Array<[string, string]> = [
  ["site/src/app/workspace/cart/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/workspace/acquisitions/page.tsx", "copy.historyLoadUnavailableHint"],
  ["site/src/app/workspace/acquisitions/receipts/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/workspace/acquisitions/receipts/[id]/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/workspace/finance/page.tsx", "copy.statementsLoadUnavailableHint"],
  ["site/src/app/workspace/library/page.tsx", "copy.loadUnavailableHint"],
  ["site/src/app/workspace/library/updates/page.tsx", "copy.updatesLoadUnavailableHint"],
  ["site/src/app/workspace/page.tsx", "dictionary.workspace.libraryUnavailableHint"],
  ["site/src/app/workspace/page.tsx", "dictionary.workspace.serversUnavailableHint"],
  [
    "site/src/app/workspace/library/collections/[id]/watches/page.tsx",
    "copy.loadUnavailableDescription",
  ],
  ["site/src/app/admin/licenses/maintenance/page.tsx", "copy.loadUnavailableHint"],
];

it("locks cart/acquisitions/finance/library workspace load failures to recovery hints", () => {
  for (const [path, hint] of pages) {
    expect(read(path), path).toContain(`description={${hint}}`);
  }
  expect(read("site/src/features/resources/resource-commerce-i18n.ts")).toContain(
    "loadUnavailableHint:",
  );
  expect(read("site/src/features/resources/resource-activity-i18n.ts")).toContain(
    "historyLoadUnavailableHint:",
  );
  expect(read("site/src/features/resources/resource-cart-receipts-i18n.ts")).toContain(
    "loadUnavailableHint:",
  );
  expect(read("site/src/features/commerce/financial-i18n.ts")).toContain(
    "statementsLoadUnavailableHint:",
  );
  expect(read("site/src/features/library/library-view.ts")).toContain("loadUnavailableHint:");
  expect(read("site/src/features/library/resource-release-control-i18n.ts")).toContain(
    "updatesLoadUnavailableHint:",
  );
  expect(read("site/src/lib/i18n/en/workspace.ts")).toContain("libraryUnavailableHint:");
  expect(read("site/src/lib/i18n/ru/workspace.ts")).toContain("serversUnavailableHint:");
  expect(read("site/src/features/commerce/license-maintenance-i18n.ts")).toContain(
    "loadUnavailableHint:",
  );
});
