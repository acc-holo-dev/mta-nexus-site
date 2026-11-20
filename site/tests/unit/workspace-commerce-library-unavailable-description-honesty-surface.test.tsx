import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const pages: Array<[string, string]> = [
  ["site/src/features/commerce/server/cart-workspace-screen.tsx", "copy.loadUnavailableHint"],
  [
    "site/src/features/resources/server/publisher-acquisitions-screen.tsx",
    "copy.historyLoadUnavailableHint",
  ],
  [
    "site/src/features/resources/server/acquisition-receipts-screen.tsx",
    "copy.loadUnavailableHint",
  ],
  [
    "site/src/features/resources/server/acquisition-receipt-detail-screen.tsx",
    "copy.loadUnavailableHint",
  ],
  [
    "site/src/features/commerce/server/workspace-finance-screen.tsx",
    "copy.statementsLoadUnavailableHint",
  ],
  ["site/src/features/library/server/library-page-screen.tsx", "copy.loadUnavailableHint"],
  [
    "site/src/features/library/server/library-updates-screen.tsx",
    "copy.updatesLoadUnavailableHint",
  ],
  [
    "site/src/features/shell/server/workspace-hub-page.tsx",
    "dictionary.workspace.libraryUnavailableHint",
  ],
  [
    "site/src/features/shell/server/workspace-hub-page.tsx",
    "dictionary.workspace.serversUnavailableHint",
  ],
  [
    "site/src/features/library/server/collection-watches-screen.tsx",
    "copy.loadUnavailableDescription",
  ],
  ["site/src/features/commerce/server/license-maintenance-screen.tsx", "copy.loadUnavailableHint"],
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
