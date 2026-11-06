import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-finance-unavailable notice. */
it("locks workspace-finance-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/finance/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-finance-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-finance-unavailable"\s+title=\{copy\.statementsLoadUnavailable\}/u,
  );
});
