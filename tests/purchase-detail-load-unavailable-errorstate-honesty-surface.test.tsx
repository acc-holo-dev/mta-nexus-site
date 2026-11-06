import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/purchases/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for purchase detail order load failure. */
it("locks purchase-detail-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="purchase-detail-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="purchase-detail-load-unavailable"\s+title=\{copy\.orderLoadUnavailable\}/u,
  );
});
