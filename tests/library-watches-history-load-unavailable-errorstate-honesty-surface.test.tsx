import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/watches/history/page.tsx"),
  "utf8",
);

/** Honesty lock for library watches history load failure. */
it("locks library-watches-history-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-watches-history-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-watches-history-load-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
});
