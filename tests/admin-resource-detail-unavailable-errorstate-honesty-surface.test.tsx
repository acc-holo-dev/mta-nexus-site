import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for admin-resource-detail-unavailable notice. */
it("locks admin-resource-detail-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/admin/resources/[id]/page.tsx"), "utf8");
  expect(source).toContain('id="admin-resource-detail-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-resource-detail-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
