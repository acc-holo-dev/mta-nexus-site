import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for admin-reconciliation-terms-unavailable notice. */
it("locks admin-reconciliation-terms-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/admin/commerce/reconciliation/[id]/terms/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="admin-reconciliation-terms-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-reconciliation-terms-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
});
