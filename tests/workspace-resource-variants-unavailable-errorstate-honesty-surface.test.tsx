import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resource-variants-unavailable notice. */
it("locks workspace-resource-variants-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/resources/[id]/variants/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-resource-variants-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resource-variants-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
