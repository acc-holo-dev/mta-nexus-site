import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for admin-license-maintenance-unavailable notice. */
it("locks admin-license-maintenance-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/admin/licenses/maintenance/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="admin-license-maintenance-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-license-maintenance-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
