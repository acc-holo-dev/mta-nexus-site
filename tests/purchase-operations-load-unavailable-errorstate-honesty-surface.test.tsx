import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/purchases/[id]/operations/page.tsx"),
  "utf8",
);

/** Honesty lock for purchase operations load failure. */
it("locks purchase-operations-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="purchase-operations-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="purchase-operations-load-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
