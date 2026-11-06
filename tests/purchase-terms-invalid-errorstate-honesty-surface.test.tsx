import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/purchases/[id]/terms/page.tsx"),
  "utf8",
);

/** Honesty lock for purchase terms invalid notice. */
it("locks purchase-terms-invalid notice to ErrorState", () => {
  expect(source).toContain('id="purchase-terms-invalid"');
  expect(source).toMatch(/<ErrorState\s+id="purchase-terms-invalid"\s+title=\{c\.invalid\}/u);
});
