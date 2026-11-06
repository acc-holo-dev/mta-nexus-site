import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/storage-maintenance-controls.tsx"),
  "utf8",
);

/** Honesty lock for storage maintenance controls form failure. */
it("locks storage-maintenance-controls-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="storage-maintenance-controls-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="storage-maintenance-controls-unavailable"\s+title=\{copy\.error\}/u,
  );
});
