import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for library release history load-unavailable notice. */
it("locks library release history unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "library-release-history-screen.tsx"), "utf8");
  expect(source).toContain('id="library-release-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-release-history-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{c.loadUnavailable}</p>');
});
