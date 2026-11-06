import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/subscriptions/reviews/new/page.tsx"),
  "utf8",
);

/** Honesty lock for subscription review new plan changed notice. */
it("locks subscription-review-new-plan-changed notice to ErrorState", () => {
  expect(source).toContain('id="subscription-review-new-plan-changed"');
  expect(source).toMatch(
    /<ErrorState\s+id="subscription-review-new-plan-changed"\s+title=\{c\.planChanged\}/u,
  );
});
