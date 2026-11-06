import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for library collections list load-unavailable notice. */
it("locks library collections list unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "library-collections-list-view.tsx"), "utf8");
  expect(source).toContain('id="library-collections-list-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collections-list-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{c.loadUnavailable}</p>');
});
