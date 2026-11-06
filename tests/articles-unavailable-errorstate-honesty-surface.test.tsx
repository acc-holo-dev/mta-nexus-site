import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/app");

/** Honesty lock for articles index unavailable notice. */
it("locks articles unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "articles/page.tsx"), "utf8");
  expect(source).toContain('id="articles-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="articles-unavailable"\s+title=\{platformCopy\.unavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{platformCopy.unavailable}</p>');
});
