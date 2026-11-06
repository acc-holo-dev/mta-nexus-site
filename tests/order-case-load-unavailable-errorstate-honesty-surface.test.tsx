import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for order case load-unavailable notice. */
it("locks order case load unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "order-case-page.tsx"), "utf8");
  expect(source).toContain('id="order-case-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="order-case-load-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
