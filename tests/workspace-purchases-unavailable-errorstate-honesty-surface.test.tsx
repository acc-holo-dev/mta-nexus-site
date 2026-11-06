import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-purchases-unavailable notice. */
it("locks workspace-purchases-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/purchases/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-purchases-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-purchases-unavailable"\s+title=\{copy\.purchasesLoadUnavailable\}/u,
  );
});
