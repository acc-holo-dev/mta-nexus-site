import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for admin-license-detail-unavailable notice. */
it("locks admin-license-detail-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/admin/licenses/[id]/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="admin-license-detail-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-license-detail-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
