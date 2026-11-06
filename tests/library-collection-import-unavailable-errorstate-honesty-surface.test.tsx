import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/library-collection-import.tsx"),
  "utf8",
);

/** Honesty lock for library collection import preview failure. */
it("locks library-collection-import-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collection-import-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-import-unavailable"\s+title=\{error\}/u,
  );
});
