import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/acquisitions/receipts/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for acquisition receipt detail load failure. */
it("locks acquisition-receipt-detail-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="acquisition-receipt-detail-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="acquisition-receipt-detail-load-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
