import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/collections/receipts/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for library collection receipt load failure. */
it("locks library-collection-receipt-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collection-receipt-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-receipt-load-unavailable"\s+title=\{r\.loadUnavailable\}/u,
  );
});
