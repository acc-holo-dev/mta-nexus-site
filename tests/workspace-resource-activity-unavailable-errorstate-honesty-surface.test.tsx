import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resource-activity-unavailable notice. */
it("locks workspace-resource-activity-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/resources/[id]/activity/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-resource-activity-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resource-activity-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
