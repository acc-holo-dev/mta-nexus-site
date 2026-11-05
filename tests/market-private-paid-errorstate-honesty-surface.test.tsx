import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/app/market/[slug]/page.tsx"), "utf8");

it("routes market private preview and paid/disabled checkout notices through ErrorState", () => {
  expect(source).toContain('import { EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="market-private-preview"');
  expect(source).toContain("title={copy.privatePreview}");
  expect(source).toContain(
    "description={`${copy.resourceStatus}: ${formatProductStatus(product.status, copy)}. ${copy.notPublic}`}",
  );
  expect(source).toContain('id="market-paid-disabled"');
  expect(source).toContain(
    "title={isPublic ? dictionary.checkout.paidDisabled : copy.notPublic}",
  );
  expect(source).toMatch(
    /!isPublic \? \(\s*<ErrorState\s+id="market-private-preview"/u,
  );
  expect(source).toMatch(
    /<ErrorState\s+id="market-paid-disabled"\s+title=\{isPublic \? dictionary\.checkout\.paidDisabled : copy\.notPublic\}/u,
  );
  expect(source).not.toContain(
    'className="rounded-xl border border-[color:var(--nexus-warning)]/25 bg-warning-soft p-4 text-sm text-warning"',
  );
  expect(source).not.toContain(
    'className="rounded-lg border border-[color:var(--nexus-warning)]/20 bg-warning-soft p-4 text-xs text-warning"',
  );
  expect(source).toContain("copy.detailUnavailable");
  expect(source).toContain("reviewCopy.pageUnavailable");
});
