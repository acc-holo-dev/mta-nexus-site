import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/content-follow-controls.tsx"),
  "utf8",
);

/** Honesty lock for content follow controls failure. */
it("locks content-follow-controls-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="content-follow-controls-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="content-follow-controls-unavailable"[\s\S]*?title=\{message \|\| copy\.error\}/u,
  );
});
