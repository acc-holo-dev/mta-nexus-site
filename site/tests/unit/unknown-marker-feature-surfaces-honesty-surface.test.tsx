import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const UNKNOWN_IMPORT = /from\s+["'][^"']*lib\/i18n\/unknown["']/u;
const UNKNOWN_USAGE = /\b(?:formatUnknown|unknownMarker)\b/u;
const LITERAL_DASH = /["']—["']/u;

function usesUnknownHelper(source: string): boolean {
  return UNKNOWN_IMPORT.test(source) && UNKNOWN_USAGE.test(source);
}

function lockUnknownHelperSurface(relative: string): void {
  const source = read(relative);
  expect(source, relative).toMatch(UNKNOWN_IMPORT);
  expect(source, relative).toMatch(UNKNOWN_USAGE);
  expect(source, relative).not.toMatch(LITERAL_DASH);
}

/** Required Wave56/57 shared surfaces that must already route unknown display through the helper. */
const REQUIRED_SURFACES = [
  "site/src/features/commerce/commerce-history-format.ts",
  "site/src/features/commerce/financial-i18n.ts",
  "site/src/features/servers/server/server-history-panel.tsx",
] as const;

/**
 * Wave57 dash-replacement candidates from hardcoded-string inventories.
 * Lock only files that already import formatUnknown/unknownMarker; skip residual literal "—" WIP.
 */
const WAVE57_DASH_REPLACEMENT_CANDIDATES = [
  "site/src/app/page.tsx",
  "site/src/app/workspace/page.tsx",
  "site/src/app/workspace/library/reviews/page.tsx",
  "site/src/app/admin/storage/objects/[id]/page.tsx",
  "site/src/app/servers/[slug]/page.tsx",
  "site/src/features/servers/components/server-card.tsx",
  "site/src/features/community/components/content-reactions.tsx",
  "site/src/features/resources/components/resource-qa-panel.tsx",
  "site/src/features/resources/components/resource-review-list.tsx",
  "site/src/features/resources/components/resource-review-controls.tsx",
  "site/src/features/resources/components/resource-compatibility-form.tsx",
  "site/src/features/library/server/collection-history-page.tsx",
  "site/src/features/library/server/collection-receipt-page.tsx",
  "site/src/features/library/server/library-collections-history-view.tsx",
  "site/src/features/library/server/library-selection-batch-screen.tsx",
  "site/src/features/resources/components/build-package-evidence.tsx",
  "site/src/features/resources/server/build-screen.tsx",
  "site/src/features/resources/server/market-page.tsx",
  "site/src/features/resources/server/resource-delivery-evidence.tsx",
  "site/src/features/resources/server/resource-review-report-screen.tsx",
  "site/src/features/resources/server/versions-page.tsx",
  "site/src/features/servers/components/server-review-panel.tsx",
] as const;

it("locks commerce-history-format, financial-i18n, and server-history-panel to lib/i18n/unknown", () => {
  for (const relative of REQUIRED_SURFACES) {
    lockUnknownHelperSurface(relative);
  }
});

it("locks migrated Wave57 dash-replacement surfaces that already import unknown helpers", () => {
  const locked: string[] = [];
  const skippedLiteral: string[] = [];

  for (const relative of WAVE57_DASH_REPLACEMENT_CANDIDATES) {
    if (!existsSync(join(root, relative))) continue;
    const source = read(relative);
    if (usesUnknownHelper(source)) {
      lockUnknownHelperSurface(relative);
      locked.push(relative);
      continue;
    }
    if (LITERAL_DASH.test(source)) {
      skippedLiteral.push(relative);
    }
  }

  expect(
    locked.length + skippedLiteral.length,
    "expected at least one Wave57 candidate to be locked or skipped as residual WIP",
  ).toBeGreaterThan(0);
});
