import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for resource-release-watch-batch-unavailable notice. */
it("locks resource-release-watch-batch-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/resource-release-watch-batch-controls.tsx"),
    "utf8",
  );
  expect(source).toContain('id="resource-release-watch-batch-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="resource-release-watch-batch-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
