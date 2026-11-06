import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for admin storage load-unavailable notice. */
it("locks admin storage unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/admin/storage/page.tsx"), "utf8");
  expect(source).toContain('id="admin-storage-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-storage-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
