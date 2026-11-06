import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace sales unavailable notice. */
it("locks workspace sales unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/sales/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-sales-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-sales-unavailable"\s+title=\{copy\.salesLoadUnavailable\}/u,
  );
});
