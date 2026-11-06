import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/collections/history/page.tsx"),
  "utf8",
);

/** Honesty lock for library collections history load failure. */
it("locks library-collections-history-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collections-history-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collections-history-load-unavailable"\s+title=\{h\.loadUnavailable\}/u,
  );
});
