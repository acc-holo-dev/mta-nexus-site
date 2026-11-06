import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for library-collection-batch-unavailable notice. */
it("locks library-collection-batch-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/library-collection-batch.tsx"),
    "utf8",
  );
  expect(source).toContain('id="library-collection-batch-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-batch-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
