import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-organizations-unavailable notice. */
it("locks workspace-organizations-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/organizations/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-organizations-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-organizations-unavailable"\s+title=\{copy\.unavailable\}/u,
  );
});
