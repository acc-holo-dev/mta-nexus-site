import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for library selection-batch load-unavailable notice. */
it("locks library selection batch unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "library-selection-batch-screen.tsx"), "utf8");
  expect(source).toContain('id="library-selection-batch-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-selection-batch-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{c.loadUnavailable}</p>');
});
