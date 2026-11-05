import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for order-terms consistency flags ErrorState. */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/order-terms-report.tsx"), "utf8");

it("locks order-terms consistency flags to ErrorState without soft text-warning", () => {
  expect(source).toContain('import { EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('amountMismatch: "order-terms-amount-mismatch"');
  expect(source).toContain('currencyMismatch: "order-terms-currency-mismatch"');
  expect(source).toContain('negativeValues: "order-terms-negative-values"');
  expect(source).toContain('unsupportedCurrency: "order-terms-unsupported-currency"');
  expect(source).toMatch(
    /flags\.map\(\(key\) => \(\s*<ErrorState key=\{key\} id=\{ORDER_TERMS_FLAG_IDS\[key\]\} title=\{c\[key\]\} \/>\s*\)\)/u,
  );
  expect(source).not.toContain('className="space-y-2 text-sm text-warning"');
  expect(source).not.toContain('<ul className="space-y-2 text-sm text-warning">');
  expect(source).not.toContain("<li key={key}>{c[key]}</li>");
});
