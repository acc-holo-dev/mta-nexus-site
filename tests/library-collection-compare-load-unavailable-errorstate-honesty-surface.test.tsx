import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/collections/[id]/compare/page.tsx"),
  "utf8",
);

/** Honesty lock for library collection compare load failure. */
it("locks library-collection-compare-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collection-compare-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-compare-load-unavailable"\s+title=\{h\.loadUnavailable\}/u,
  );
});
