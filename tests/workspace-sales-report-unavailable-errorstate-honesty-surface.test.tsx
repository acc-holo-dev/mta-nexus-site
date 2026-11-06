import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-sales-report-unavailable notice. */
it("locks workspace-sales-report-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/sales/report/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-sales-report-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-sales-report-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
});
