import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/app");

/** Honesty lock for admin hub load-unavailable notice. */
it("locks admin hub unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "admin/page.tsx"), "utf8");
  expect(source).toContain('id="admin-hub-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-hub-unavailable"\s+title=\{copy\.hubUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.hubUnavailable}</p>');
});
