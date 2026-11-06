import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for plan-review-form-unavailable notice. */
it("locks plan-review-form-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/plan-review-form.tsx"),
    "utf8",
  );
  expect(source).toContain('id="plan-review-form-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="plan-review-form-unavailable"[\s\S]*?title=\{error\}/u);
});
