import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/collections/resources/page.tsx"),
  "utf8",
);

/** Honesty lock for library collection resources load failure. */
it("locks library-collection-resources-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collection-resources-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-resources-load-unavailable"\s+title=\{v\.loadUnavailable\}/u,
  );
});
