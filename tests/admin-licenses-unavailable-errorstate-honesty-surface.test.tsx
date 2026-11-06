import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for admin licenses load-unavailable notice. */
it("locks admin licenses unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/admin/licenses/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="admin-licenses-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-licenses-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
