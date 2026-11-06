import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for report-moderation-controls-unavailable notice. */
it("locks report-moderation-controls-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/report-moderation-controls.tsx"),
    "utf8",
  );
  expect(source).toContain('id="report-moderation-controls-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="report-moderation-controls-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
