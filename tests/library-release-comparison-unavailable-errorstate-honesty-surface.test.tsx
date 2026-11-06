import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for library release comparison load-unavailable notice. */
it("locks library release comparison unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "library-release-comparison-screen.tsx"), "utf8");
  expect(source).toContain('id="library-release-comparison-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-release-comparison-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{c.loadUnavailable}</p>');
});
