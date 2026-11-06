import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for admin-commerce-plans-unavailable notice. */
it("locks admin-commerce-plans-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/admin/commerce/plans/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="admin-commerce-plans-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-commerce-plans-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
