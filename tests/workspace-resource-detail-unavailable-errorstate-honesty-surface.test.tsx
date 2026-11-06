import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resource-detail-unavailable notice. */
it("locks workspace-resource-detail-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/resources/[id]/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-resource-detail-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resource-detail-unavailable"\s+title=\{publisherCopy\.loadUnavailable\}/u,
  );
});
