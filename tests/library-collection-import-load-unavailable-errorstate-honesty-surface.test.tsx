import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/collections/[id]/import/page.tsx"),
  "utf8",
);

/** Honesty lock for library collection import load failure. */
it("locks library-collection-import-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collection-import-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-import-load-unavailable"\s+title=\{m\.loadUnavailable\}/u,
  );
});
