import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for order-case-forms-unavailable notice. */
it("locks order-case-forms-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/order-case-forms.tsx"),
    "utf8",
  );
  expect(source).toContain('id="order-case-forms-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="order-case-forms-unavailable"[\s\S]*?title=\{error\}/u);
});
