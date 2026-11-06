import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/acquisitions/receipts/page.tsx"),
  "utf8",
);

/** Honesty lock for acquisitions receipts invalid notice. */
it("locks acquisitions-receipts-invalid notice to ErrorState", () => {
  expect(source).toContain('id="acquisitions-receipts-invalid"');
  expect(source).toMatch(
    /<ErrorState\s+id="acquisitions-receipts-invalid"\s+title=\{copy\.invalid\}/u,
  );
});
