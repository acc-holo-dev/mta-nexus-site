import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for acquire-product-unavailable notice. */
it("locks acquire-product-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/acquire/page.tsx"), "utf8");
  expect(source).toContain('id="acquire-product-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="acquire-product-unavailable"[\s\S]*?title=\{productError\}/u,
  );
});
