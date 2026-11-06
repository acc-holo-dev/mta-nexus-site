import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for admin-commerce-plan-detail-unavailable notice. */
it("locks admin-commerce-plan-detail-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/admin/commerce/plans/[id]/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="admin-commerce-plan-detail-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-commerce-plan-detail-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
