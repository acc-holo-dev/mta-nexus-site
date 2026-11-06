import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/publication-feed.tsx"), "utf8");

/** Honesty lock for publication feed failure. */
it("locks publication-feed-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="publication-feed-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="publication-feed-unavailable"\s+title=\{error\}/u);
});
