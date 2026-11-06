import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/collections/[id]/watches/page.tsx"),
  "utf8",
);

/** Honesty lock for library collection watches load failure. */
it("locks library-collection-watches-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collection-watches-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-watches-load-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
