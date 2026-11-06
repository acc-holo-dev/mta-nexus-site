import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/reaction-removal.tsx"), "utf8");

/** Honesty lock for reaction removal blocked notice. */
it("locks reaction-removal-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="reaction-removal-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="reaction-removal-unavailable"\s+title=\{message\}/u);
});
