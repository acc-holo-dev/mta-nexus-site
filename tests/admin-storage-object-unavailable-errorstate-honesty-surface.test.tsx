import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for admin-storage-object-unavailable notice. */
it("locks admin-storage-object-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/admin/storage/objects/[id]/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="admin-storage-object-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-storage-object-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
