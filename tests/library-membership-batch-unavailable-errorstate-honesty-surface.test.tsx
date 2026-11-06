import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for library-membership-batch-unavailable notice. */
it("locks library-membership-batch-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/library-membership-batch.tsx"),
    "utf8",
  );
  expect(source).toContain('id="library-membership-batch-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-membership-batch-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
