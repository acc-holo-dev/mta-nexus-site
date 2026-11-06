import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for library-selection-batch-controls-unavailable notice. */
it("locks library-selection-batch-controls-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/library-selection-batch-controls.tsx"),
    "utf8",
  );
  expect(source).toContain('id="library-selection-batch-controls-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-selection-batch-controls-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
