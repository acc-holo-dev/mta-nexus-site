import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for community-report-detail-unavailable notice. */
it("locks community-report-detail-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/community-report-detail.tsx"),
    "utf8",
  );
  expect(source).toContain('id="community-report-detail-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="community-report-detail-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
