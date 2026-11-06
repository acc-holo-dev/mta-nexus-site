import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/author-publication-restore.tsx"),
  "utf8",
);

/** Honesty lock for author publication restore notice failure. */
it("locks author-publication-restore-notice-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="author-publication-restore-notice-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="author-publication-restore-notice-unavailable"[\s\S]*?title=\{notice\}/u,
  );
});
