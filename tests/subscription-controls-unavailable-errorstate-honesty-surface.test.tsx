import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/subscription-controls.tsx"),
  "utf8",
);

/** Honesty lock for subscription controls form failure. */
it("locks subscription-controls-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="subscription-controls-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="subscription-controls-unavailable"\s+title=\{error\}/u);
});
