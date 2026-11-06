import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for admin resources load-unavailable notice. */
it("locks admin resources unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/admin/resources/page.tsx"), "utf8");
  expect(source).toContain('id="admin-resources-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-resources-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
