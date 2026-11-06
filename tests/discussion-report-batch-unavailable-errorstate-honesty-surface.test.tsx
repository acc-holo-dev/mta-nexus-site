import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/discussion-report-batch.tsx"),
  "utf8",
);

/** Honesty lock for discussion report batch failure. */
it("locks discussion-report-batch-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="discussion-report-batch-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="discussion-report-batch-unavailable"\s+title=\{error\}/u,
  );
});
