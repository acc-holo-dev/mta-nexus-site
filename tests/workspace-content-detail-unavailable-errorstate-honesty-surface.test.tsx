import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-content-detail-unavailable notice. */
it("locks workspace-content-detail-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/content/[id]/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-content-detail-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-content-detail-unavailable"\s+title=\{copy\.unavailable\}/u,
  );
});
