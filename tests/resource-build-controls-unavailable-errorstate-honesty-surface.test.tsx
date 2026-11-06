import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/resource-build-controls.tsx"),
  "utf8",
);

/** Honesty lock for resource build controls failure. */
it("locks resource-build-controls-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="resource-build-controls-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="resource-build-controls-unavailable"\s+title=\{message\}/u,
  );
});
