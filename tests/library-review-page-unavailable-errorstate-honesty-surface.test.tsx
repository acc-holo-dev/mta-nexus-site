import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/review/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for library review page unavailable. */
it("locks library-review-page-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-review-page-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-review-page-unavailable"\s+title=\{copy\.pageUnavailable\}/u,
  );
});
