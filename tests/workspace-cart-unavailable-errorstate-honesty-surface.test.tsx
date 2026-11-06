import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-cart-unavailable notice. */
it("locks workspace-cart-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/cart/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-cart-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-cart-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
