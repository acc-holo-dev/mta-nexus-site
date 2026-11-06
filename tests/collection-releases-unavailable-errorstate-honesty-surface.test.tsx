import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for collection releases load-unavailable notice. */
it("locks collection releases unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "collection-releases-screen.tsx"), "utf8");
  expect(source).toContain('id="collection-releases-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="collection-releases-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{c.loadUnavailable}</p>');
});
