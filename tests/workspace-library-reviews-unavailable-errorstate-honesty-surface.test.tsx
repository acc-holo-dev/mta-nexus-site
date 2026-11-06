import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-library-reviews-unavailable notice. */
it("locks workspace-library-reviews-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/library/reviews/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-library-reviews-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-library-reviews-unavailable"\s+title=\{copy\.pageUnavailable\}/u,
  );
});
