import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/subscriptions/reviews/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for subscription review detail invalid selection. */
it("locks subscription-review-detail-invalid notice to ErrorState", () => {
  expect(source).toContain('id="subscription-review-detail-invalid"');
  expect(source).toMatch(
    /<ErrorState\s+id="subscription-review-detail-invalid"\s+title=\{c\.invalid\}/u,
  );
});
